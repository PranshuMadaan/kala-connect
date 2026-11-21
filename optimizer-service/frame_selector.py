"""
Kala Connect Video-to-Image Optimizer Engine
Multi-Objective Quality, Viewpoint Coverage, Visual Diversity & Redundancy Minimization
S* = argmax [ alpha * Q(S) + beta * C(S) + gamma * D(S) - delta * R(S) ]

Preserves artisan product integrity: 100% genuine video frame extraction.
Zero generative synthesis, zero hallucinated textures.
"""

import argparse
import csv
import math
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple, Set

import cv2
import numpy as np

SCORE_WIDTH = 640           # Frames downscaled to this width for fast feature scoring
POOL_MIN, POOL_MAX = 20, 150
DEFAULT_POOL = 80
DEFAULT_FPS = 10.0
MAX_SAMPLED_FRAMES = 1200   # Hard cap on analysed frames (bounds memory/CPU)
MAX_VIDEO_SECONDS = 180
POOL_IMAGE_WIDTH = 1280     # Candidate pool images saved at web-ready HD width
BLUR_WARN_RAW = 40.0        # Heuristic sharpness alert threshold

SUPPORTED_ANGLES = [
    "FRONT_HERO",
    "PERSPECTIVE_45",
    "MACRO_DETAIL",
    "MAKER_MARK",
    "REAR_OVERVIEW"
]


class VideoSelectionError(Exception):
    """Bad input (unreadable/corrupt video, excessive duration, invalid params). Safe for client display."""


@dataclass
class CandidateImage:
    rank: int
    frame_index: int
    timestamp_sec: float
    quality: float
    sharpness_raw: float
    exposure: float
    contrast: float
    detected_angle: str
    path: str
    is_hero: bool = False


@dataclass
class SelectedImage:
    rank: int
    frame_index: int
    timestamp_sec: float
    quality: float
    sharpness_raw: float
    exposure: float
    contrast: float
    detected_angle: str
    path: str
    original_path: str
    is_hero: bool = False


@dataclass
class PoolResult:
    images: List[CandidateImage]
    frames_analysed: int
    duration_sec: float
    fps: float
    warnings: List[str] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


# =====================================================================
# Extensible Feature Extraction Interface
# (Allows plugging in CLIP or pretrained embeddings in the future)
# =====================================================================

class BaseFeatureExtractor(ABC):
    @abstractmethod
    def compute_features(self, frame_bgr: np.ndarray, timestamp_sec: float) -> dict:
        """Extracts quality, viewpoint classification, and visual representation vector."""
        pass


class ClassicalCVFeatureExtractor(BaseFeatureExtractor):
    """
    High-performance classical computer vision extractor:
    - Laplacian variance for sharpness
    - Mean pixel luminance with extreme clipping penalty for exposure
    - Luminance standard deviation for contrast
    - HSV color histogram for visual diversity
    - Structural symmetry & gradient heuristics for viewpoint classification
    """

    def compute_features(self, frame_bgr: np.ndarray, timestamp_sec: float) -> dict:
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # 1. Sharpness via Gaussian filtered Laplacian variance
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        sharp_raw = float(cv2.Laplacian(blurred, cv2.CV_64F).var())

        # 2. Exposure: Optimal around 120-150, penalizing extreme over/underexposure
        mean_lum = float(gray.mean())
        mean_term = 1.0 - abs(mean_lum - 135.0) / 135.0
        clipped_ratio = float(((gray < 5) | (gray > 250)).mean())
        exposure = float(np.clip(mean_term - 2.0 * clipped_ratio, 0.0, 1.0))

        # 3. Contrast: Normalized standard deviation of luminance
        std_lum = float(gray.std())
        contrast = float(np.clip(std_lum / 64.0, 0.0, 1.0))

        # 4. Viewpoint classification heuristics
        center_crop = gray[int(h * 0.25):int(h * 0.75), int(w * 0.25):int(w * 0.75)]
        center_lap = float(cv2.Laplacian(center_crop, cv2.CV_64F).var()) if center_crop.size > 0 else 0.0

        left_half = gray[:, :int(w / 2)]
        right_half = cv2.flip(gray[:, int(w / 2):], 1)
        min_w = min(left_half.shape[1], right_half.shape[1])
        sym_diff = float(np.abs(left_half[:, :min_w].astype(float) - right_half[:, :min_w].astype(float)).mean())

        if center_lap > 450:
            detected_angle = "MACRO_DETAIL"
        elif sym_diff < 32.0:
            detected_angle = "FRONT_HERO"
        elif sym_diff < 58.0:
            detected_angle = "PERSPECTIVE_45"
        elif mean_lum < 95.0:
            detected_angle = "MAKER_MARK"
        else:
            detected_angle = "REAR_OVERVIEW"

        # 5. Color histogram in HSV space for visual diversity distance
        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 8, 8], [0, 180, 0, 256, 0, 256])
        cv2.normalize(hist, hist)
        feature_vector = hist.flatten()

        return {
            "sharpness_raw": sharp_raw,
            "exposure": exposure,
            "contrast": contrast,
            "detected_angle": detected_angle,
            "feature_vector": feature_vector
        }


# =====================================================================
# Video I/O Helpers
# =====================================================================

def _open_video(video_path: str) -> cv2.VideoCapture:
    if not os.path.exists(video_path):
        raise VideoSelectionError("The specified video file does not exist.")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise VideoSelectionError("Could not open video file. Verify file is an intact MP4 or MOV.")
    prop = getattr(cv2, "CAP_PROP_ORIENTATION_AUTO", None)
    if prop is not None:
        cap.set(prop, 1)
    return cap


def _resize_to_width(frame: np.ndarray, width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= width:
        return frame
    return cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)


def _minmax(values: np.ndarray) -> np.ndarray:
    v = np.asarray(values, dtype=np.float64)
    rng = v.max() - v.min()
    return np.zeros_like(v) if rng < 1e-12 else (v - v.min()) / rng


# =====================================================================
# Pipeline Pass 1: Streaming Sampling & Feature Analysis
# =====================================================================

def analyze_video_frames(
    video_path: str,
    pool_size: int = DEFAULT_POOL,
    sample_fps: float = DEFAULT_FPS,
    feature_extractor: Optional[BaseFeatureExtractor] = None
) -> Tuple[np.ndarray, List[dict], float, float]:
    """
    Streams through video, sampling at approximately sample_fps.
    Returns (sample_indices, feature_dicts, native_fps, duration_sec).
    """
    if feature_extractor is None:
        feature_extractor = ClassicalCVFeatureExtractor()

    cap = _open_video(video_path)
    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if native_fps > 240 or native_fps < 1:
        native_fps = 30.0
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0

    if total_frames and (total_frames / native_fps) > MAX_VIDEO_SECONDS:
        cap.release()
        raise VideoSelectionError(f"Video duration exceeds {MAX_VIDEO_SECONDS} seconds limit. Please upload a shorter clip.")

    if total_frames:
        duration_sec = total_frames / native_fps
        desired_samples = min(MAX_SAMPLED_FRAMES, max(pool_size * 4, int(duration_sec * sample_fps)))
        step = max(1, int(total_frames // desired_samples))
    else:
        step = max(1, int(round(native_fps / sample_fps)))
        duration_sec = 0.0

    sample_indices = []
    features_list = []
    idx = 0

    while cap.grab():
        if idx % step == 0:
            ok, frame = cap.retrieve()
            if ok:
                timestamp = round(float(idx / native_fps), 3)
                downscaled = _resize_to_width(frame, SCORE_WIDTH)
                feats = feature_extractor.compute_features(downscaled, timestamp)
                feats["frame_index"] = idx
                feats["timestamp_sec"] = timestamp
                sample_indices.append(idx)
                features_list.append(feats)
        idx += 1
        if idx / native_fps > MAX_VIDEO_SECONDS + 1:
            cap.release()
            raise VideoSelectionError(f"Video duration exceeds {MAX_VIDEO_SECONDS} seconds limit.")

    cap.release()

    if not sample_indices:
        raise VideoSelectionError("No valid video frames could be read from the file.")

    if not duration_sec:
        duration_sec = idx / native_fps

    return np.array(sample_indices), features_list, native_fps, duration_sec


# =====================================================================
# Pipeline Pass 2: Temporal & Quality Candidate Pool Selection
# =====================================================================

def _pick_temporal_spread(qualities: np.ndarray, times: np.ndarray, target_count: int, duration: float) -> List[int]:
    """Selects top-quality frames while enforcing temporal spacing to avoid burst clusters."""
    n = len(qualities)
    target = min(target_count, n)
    order = np.argsort(-qualities)
    gap = 0.5 * duration / max(target, 1)

    for _ in range(8):
        chosen = []
        for i in order:
            if all(abs(times[i] - times[j]) >= gap for j in chosen):
                chosen.append(int(i))
                if len(chosen) == target:
                    return chosen
        gap /= 2.0

    chosen_set = set(chosen)
    for i in order:
        if len(chosen) == target:
            break
        if int(i) not in chosen_set:
            chosen.append(int(i))
    return chosen


def _write_frames_to_disk(video_path: str, wanted_indices: Set[int], out_dir: str, name_map: Dict[int, str], max_width: Optional[int]) -> Dict[int, str]:
    """Decodes video sequentially and writes specified frames to disk immediately without storing in RAM."""
    os.makedirs(out_dir, exist_ok=True)
    remaining = set(wanted_indices)
    saved = {}
    cap = _open_video(video_path)
    idx = 0

    while remaining and cap.grab():
        if idx in remaining:
            ok, frame = cap.retrieve()
            if ok:
                if max_width:
                    frame = _resize_to_width(frame, max_width)
                target_path = os.path.join(out_dir, name_map[idx])
                cv2.imwrite(target_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
                saved[idx] = target_path
            remaining.discard(idx)
        idx += 1

    cap.release()
    return saved


# =====================================================================
# Multi-Objective MMR Subset Selection
# S* = argmax [ alpha * Q(S) + beta * C(S) + gamma * D(S) - delta * R(S) ]
# =====================================================================

def select_diverse_optimal_subset(
    candidates: List[CandidateImage],
    features_by_index: Dict[int, dict],
    k: int = 5,
    alpha: float = 0.35,
    beta: float = 0.25,
    gamma: float = 0.25,
    delta: float = 0.15
) -> Tuple[List[CandidateImage], float, dict]:
    """
    Selects optimal diverse subset S of size K using Maximal Marginal Relevance (MMR)
    across quality, viewpoint coverage, color feature distance, and temporal redundancy.
    """
    k = max(1, min(k, len(candidates), 10))

    if len(candidates) <= k:
        selected = sorted(candidates, key=lambda c: c.quality, reverse=True)
        for r, item in enumerate(selected, 1):
            item.rank = r
            item.is_hero = (r == 1)
        covered = list(set(c.detected_angle for c in selected))
        return selected, 1.0, {
            "requiredViews": len(SUPPORTED_ANGLES),
            "coveredViews": len(covered),
            "missingViews": [a for a in SUPPORTED_ANGLES if a not in covered],
            "coveredList": covered
        }

    # Pre-filter top candidates (up to 30) by quality for efficient combinatorial search
    pool = sorted(candidates, key=lambda c: c.quality, reverse=True)[:30]

    import itertools

    best_subset = None
    best_score = -float('inf')

    for subset in itertools.combinations(pool, k):
        # 1. Quality Q(S): Average composite quality
        Q = sum(c.quality for c in subset) / k

        # 2. Viewpoint Coverage C(S): Distinct angles ratio
        unique_angles = len(set(c.detected_angle for c in subset))
        C = unique_angles / min(len(SUPPORTED_ANGLES), float(k))

        # 3. Visual Diversity D(S) & Redundancy R(S)
        pairwise_dists = []
        redundancy_penalties = []

        for c1, c2 in itertools.combinations(subset, 2):
            dt = abs(c1.timestamp_sec - c2.timestamp_sec)
            if dt < 1.0:
                redundancy_penalties.append(math.exp(-1.5 * dt))
            else:
                redundancy_penalties.append(0.0)

            v1 = features_by_index.get(c1.frame_index, {}).get("feature_vector")
            v2 = features_by_index.get(c2.frame_index, {}).get("feature_vector")

            if v1 is not None and v2 is not None:
                dot = float(np.dot(v1, v2))
                norm1 = float(np.linalg.norm(v1))
                norm2 = float(np.linalg.norm(v2))
                if norm1 > 0 and norm2 > 0:
                    sim = max(0.0, min(1.0, dot / (norm1 * norm2)))
                    pairwise_dists.append(1.0 - sim)
                else:
                    pairwise_dists.append(0.5)
            else:
                pairwise_dists.append(min(1.0, dt / 8.0))

        D = float(sum(pairwise_dists) / len(pairwise_dists)) if pairwise_dists else 0.5
        R = float(sum(redundancy_penalties) / len(redundancy_penalties)) if redundancy_penalties else 0.0

        score = alpha * Q + beta * C + gamma * D - delta * R

        if score > best_score:
            best_score = score
            best_subset = subset

    selected_list = sorted(list(best_subset), key=lambda c: c.quality, reverse=True)
    for r, item in enumerate(selected_list, 1):
        item.rank = r
        item.is_hero = (r == 1)

    covered = list(set(c.detected_angle for c in selected_list))
    coverage_info = {
        "requiredViews": len(SUPPORTED_ANGLES),
        "coveredViews": len(covered),
        "missingViews": [a for a in SUPPORTED_ANGLES if a not in covered],
        "coveredList": covered
    }

    return selected_list, round(best_score, 4), coverage_info


# =====================================================================
# Main Public Functions
# =====================================================================

def build_candidate_pool(
    video_path: str,
    out_dir: str,
    pool_size: int = DEFAULT_POOL,
    sample_fps: float = DEFAULT_FPS,
    w_sharp: float = 0.50,
    w_exp: float = 0.25,
    w_con: float = 0.25
) -> Tuple[PoolResult, Dict[int, dict]]:
    """
    Builds the candidate pool of frames (20-150) from the input video.
    Returns (PoolResult, features_by_index).
    """
    if not isinstance(pool_size, int) or not (POOL_MIN <= pool_size <= POOL_MAX):
        raise VideoSelectionError(f"Pool size must be an integer between {POOL_MIN} and {POOL_MAX}.")

    idxs, features_list, fps, duration = analyze_video_frames(video_path, pool_size, sample_fps)
    n = len(idxs)

    sharp_raw = np.array([f["sharpness_raw"] for f in features_list])
    expo = np.array([f["exposure"] for f in features_list])
    con = np.array([f["contrast"] for f in features_list])
    times = np.array([f["timestamp_sec"] for f in features_list])

    # Log-transform raw sharpness to bound high-frequency camera noise
    sharp_norm = _minmax(np.log1p(sharp_raw))
    quality = w_sharp * sharp_norm + w_exp * expo + w_con * con

    for i, q in enumerate(quality):
        features_list[i]["quality"] = float(q)

    chosen_indices = _pick_temporal_spread(quality, times, pool_size, duration)
    chosen_indices.sort(key=lambda i: -quality[i])

    name_map = {int(idxs[i]): f"cand_{r:03d}.jpg" for r, i in enumerate(chosen_indices, 1)}
    saved_paths = _write_frames_to_disk(video_path, set(name_map.keys()), out_dir, name_map, POOL_IMAGE_WIDTH)

    warnings = []
    images = []
    features_by_index = {}

    for r, i in enumerate(chosen_indices, 1):
        fi = int(idxs[i])
        if fi not in saved_paths:
            continue
        feats = features_list[i]
        features_by_index[fi] = feats
        images.append(CandidateImage(
            rank=r,
            frame_index=fi,
            timestamp_sec=round(float(times[i]), 2),
            quality=round(float(quality[i]), 3),
            sharpness_raw=round(float(sharp_raw[i]), 1),
            exposure=round(float(expo[i]), 3),
            contrast=round(float(con[i]), 3),
            detected_angle=feats.get("detected_angle", "FRONT_HERO"),
            path=saved_paths[fi],
            is_hero=(r == 1)
        ))

    if len(images) < pool_size:
        warnings.append(f"Only {len(images)} candidate frames available (requested {pool_size}). The video may be short.")
    if images and max(im.sharpness_raw for im in images) < BLUR_WARN_RAW:
        warnings.append("Video appears blurry overall. Suggest recording in steady natural daylight.")

    pool_result = PoolResult(
        images=images,
        frames_analysed=n,
        duration_sec=round(duration, 2),
        fps=round(fps, 2),
        warnings=warnings
    )

    return pool_result, features_by_index


def extract_original_frames(video_path: str, frame_indices: List[int], out_dir: str) -> Dict[int, str]:
    """
    Re-extracts selected frames at 100% ORIGINAL native resolution from the master video.
    Never upscales or modifies pixels.
    """
    name_map = {int(i): f"orig_{int(i):06d}.jpg" for i in frame_indices}
    return _write_frames_to_disk(video_path, set(name_map.keys()), out_dir, name_map, max_width=None)
