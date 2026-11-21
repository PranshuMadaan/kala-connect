"""
Kala Connect Multi-Objective Video-to-Image Optimizer
Evaluates candidate image subsets S of size K from extracted frames F:
S* = argmax [ alpha * Q(S) + beta * C(S) + gamma * D(S) - delta * R(S) ]

Where:
- Q(S): Mean image quality of the subset
- C(S): Viewpoint coverage (diversity of unique angles covered: Front, 45-deg, Macro, Base, Rear)
- D(S): Visual diversity (pairwise color histogram / feature distance across frames in S)
- R(S): Redundancy penalty (penalizing temporally adjacent / near-identical frames)
"""

import sys
import os
import json
import itertools
import math
from quality import assess_frame_quality

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def compute_frame_histogram(image_path: str):
    """Computes a normalized 3D color histogram for diversity calculations."""
    if not HAS_CV2 or not os.path.exists(image_path):
        return None
    img = cv2.imread(image_path)
    if img is None:
        return None
    # 8 bins per channel in HSV space for robust color matching
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 8, 8], [0, 180, 0, 256, 0, 256])
    cv2.normalize(hist, hist)
    return hist.flatten()


def optimize_frame_selection(frames_dir: str, k: int = 5, alpha: float = 0.35, beta: float = 0.25, gamma: float = 0.25, delta: float = 0.15) -> dict:
    """
    Scans frames_dir, analyzes all frames, and finds the optimal subset S* of size K.
    """
    if not os.path.exists(frames_dir):
        return {"error": f"Directory not found: {frames_dir}"}

    # Find all frame images
    valid_exts = ('.jpg', '.jpeg', '.png')
    frame_files = sorted([f for f in os.listdir(frames_dir) if f.lower().endswith(valid_exts)])

    if len(frame_files) == 0:
        return {"error": "No frames found in directory"}

    # Assess quality & metadata for each frame
    evaluated_frames = []
    for idx, f in enumerate(frame_files):
        f_path = os.path.join(frames_dir, f)
        quality_data = assess_frame_quality(f_path)
        hist = compute_frame_histogram(f_path)
        
        # Time estimate from filename or index (sampled at ~2 fps -> idx * 0.5s)
        timestamp_sec = round(idx * 0.5, 2)

        evaluated_frames.append({
            "filename": f,
            "path": f_path,
            "index": idx,
            "timestamp": timestamp_sec,
            "sharpness": quality_data.get("sharpness", 0.5),
            "exposure": quality_data.get("exposure", 0.5),
            "contrast": quality_data.get("contrast", 0.5),
            "quality_score": quality_data.get("quality_score", 0.5),
            "detected_angle": quality_data.get("detected_angle", "FRONT_HERO"),
            "histogram": hist
        })

    # If total frames <= k, return all frames sorted by quality
    if len(evaluated_frames) <= k:
        selected = sorted(evaluated_frames, key=lambda x: x["quality_score"], reverse=True)
        return format_result(selected, evaluated_frames, k)

    # Pre-filter top N candidates (e.g. top 25) by quality to make combinatorial search fast
    candidates_pool = sorted(evaluated_frames, key=lambda x: x["quality_score"], reverse=True)[:25]

    best_subset = None
    best_score = -float('inf')

    # Combinatorial search over subsets of size K
    for subset in itertools.combinations(candidates_pool, k):
        # 1. Quality Q(S): average composite quality
        Q = sum(f["quality_score"] for f in subset) / k

        # 2. Viewpoint Coverage C(S): count of distinct angles covered
        unique_angles = len(set(f["detected_angle"] for f in subset))
        C = unique_angles / min(5.0, float(k))

        # 3. Visual Diversity D(S) & Redundancy R(S)
        pairwise_dists = []
        redundancy_penalties = []

        for f1, f2 in itertools.combinations(subset, 2):
            # Temporal difference penalty
            dt = abs(f1["timestamp"] - f2["timestamp"])
            # Penalty is high if frames are within 1.0 second of each other
            if dt < 1.0:
                redundancy_penalties.append(math.exp(-1.5 * dt))
            else:
                redundancy_penalties.append(0.0)

            # Histogram distance
            if f1["histogram"] is not None and f2["histogram"] is not None:
                # Cosine distance
                dot = np.dot(f1["histogram"], f2["histogram"])
                norm1 = np.linalg.norm(f1["histogram"])
                norm2 = np.linalg.norm(f2["histogram"])
                if norm1 > 0 and norm2 > 0:
                    sim = max(0.0, min(1.0, dot / (norm1 * norm2)))
                    pairwise_dists.append(1.0 - sim)
                else:
                    pairwise_dists.append(0.5)
            else:
                # Fallback: time separation normalized as proxy diversity
                pairwise_dists.append(min(1.0, dt / 10.0))

        D = sum(pairwise_dists) / len(pairwise_dists) if pairwise_dists else 0.5
        R = sum(redundancy_penalties) / len(redundancy_penalties) if redundancy_penalties else 0.0

        # Multi-objective formulation: S* = alpha*Q + beta*C + gamma*D - delta*R
        score = alpha * Q + beta * C + gamma * D - delta * R

        if score > best_score:
            best_score = score
            best_subset = subset

    return format_result(best_subset, evaluated_frames, k)


def format_result(selected_subset, all_frames, k):
    """Cleans up results for JSON output."""
    output_selected = []
    for rank, f in enumerate(selected_subset, 1):
        output_selected.append({
            "rank": rank,
            "filename": f["filename"],
            "imageUrl": f"/uploads/frames/{f['filename']}",
            "timestamp": f["timestamp"],
            "qualityScore": round(f["quality_score"], 2),
            "sharpness": round(f["sharpness"], 2),
            "exposure": round(f["exposure"], 2),
            "detectedAngle": f["detected_angle"],
            "isHero": (rank == 1)
        })

    candidate_frames = []
    for f in all_frames[:15]:
        candidate_frames.append({
            "filename": f["filename"],
            "imageUrl": f"/uploads/frames/{f['filename']}",
            "timestamp": f["timestamp"],
            "qualityScore": round(f["quality_score"], 2),
            "detectedAngle": f["detected_angle"]
        })

    # Coverage checklist stats
    covered_views = list(set(f["detectedAngle"] for f in output_selected))
    all_required = ["FRONT_HERO", "PERSPECTIVE_45", "MACRO_DETAIL", "MAKER_MARK", "REAR_OVERVIEW"]
    missing_views = [v for v in all_required if v not in covered_views]

    return {
        "k": k,
        "selectedImages": output_selected,
        "candidateFrames": candidate_frames,
        "coverage": {
            "requiredViews": len(all_required),
            "coveredViews": len(covered_views),
            "missingViews": missing_views,
            "coveredList": covered_views
        }
    }


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
        k_val = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        res = optimize_frame_selection(target_dir, k=k_val)
        print(json.dumps(res))
