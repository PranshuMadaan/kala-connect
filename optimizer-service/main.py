import os
import json
import uuid
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from frame_selector import (
    build_candidate_pool,
    select_diverse_optimal_subset,
    extract_original_frames,
    VideoSelectionError,
    SUPPORTED_ANGLES
)

# --------------------------------
# Configuration
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
ARTIFACT_DIR = BASE_DIR / "artifacts"

UPLOAD_DIR.mkdir(exist_ok=True)
ARTIFACT_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}

app = FastAPI(
    title="Kala Connect Video-to-Image Optimizer API",
    version="2.0.0",
    description="Multi-Objective CV Optimization Engine for Handcrafted Artisan Product Cataloging"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Serves candidate and original full-resolution images
app.mount(
    "/artifacts",
    StaticFiles(directory=str(ARTIFACT_DIR)),
    name="artifacts"
)


# --------------------------------
# Job State Persistence Helpers
# --------------------------------

def _job_meta_path(job_id: str) -> Path:
    return ARTIFACT_DIR / job_id / "job_meta.json"


def _save_job_meta(job_id: str, data: dict):
    meta_path = _job_meta_path(job_id)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    with meta_path.open("w", encoding="utf-8") as f:
        # Strip non-serializable objects
        clean = json.loads(json.dumps(data, default=lambda o: getattr(o, '__dict__', str(o))))
        json.dump(clean, f, indent=2)


def _load_job_meta(job_id: str) -> Optional[dict]:
    meta_path = _job_meta_path(job_id)
    if not meta_path.exists():
        return None
    with meta_path.open("r", encoding="utf-8") as f:
        return json.load(f)


# --------------------------------
# Pydantic Schemas
# --------------------------------

class ApprovalRequest(BaseModel):
    approved_frame_indices: Optional[List[int]] = None
    hero_frame_index: Optional[int] = None


class RejectionRequest(BaseModel):
    rejected_frame_indices: Optional[List[int]] = None
    reason: Optional[str] = None


class ReExtractionRequest(BaseModel):
    frame_indices: List[int]


# --------------------------------
# Health & Discovery
# --------------------------------

@app.get("/")
def root():
    return {
        "service": "Kala Connect Video-to-Image Optimizer",
        "status": "running",
        "version": "2.0.0",
        "objective": "S* = argmax [ alpha*Q(S) + beta*C(S) + gamma*D(S) - delta*R(S) ]",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Kala Connect Video-to-Image Optimizer",
        "version": "2.0.0"
    }


# --------------------------------
# Video Optimization Core Endpoint
# --------------------------------

@app.post("/api/v1/candidates")
@app.post("/api/optimizer/candidates")
def generate_candidates(
    video: UploadFile = File(...),
    pool_size: int = Form(80),
    sample_fps: float = Form(10.0),
    final_k: int = Form(5),
    alpha: float = Form(0.35),
    beta: float = Form(0.25),
    gamma: float = Form(0.25),
    delta: float = Form(0.15)
):
    """
    Main pipeline:
    1. Validates and stores source video
    2. Builds candidate pool of time-spread, high-quality frames (20-150)
    3. Solves multi-objective MMR S* = argmax [ alpha*Q + beta*C + gamma*D - delta*R ]
    4. Extracts selected images at 100% original uncompressed resolution
    5. Returns candidate pool, selected images, and coverage metadata
    """
    job_id = str(uuid.uuid4())
    extension = Path(video.filename or "").suffix.lower()
    if not extension:
        extension = ".mp4"

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{extension}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    if not 20 <= pool_size <= 150:
        raise HTTPException(
            status_code=400,
            detail="Pool size must be an integer between 20 and 150."
        )

    if not 0.5 <= sample_fps <= 30.0:
        raise HTTPException(
            status_code=400,
            detail="Sampling FPS must be between 0.5 and 30.0."
        )

    if not 1 <= final_k <= 10:
        raise HTTPException(
            status_code=400,
            detail="Final image count (k) must be between 1 and 10."
        )

    job_upload_dir = UPLOAD_DIR / job_id
    job_artifact_dir = ARTIFACT_DIR / job_id
    original_artifact_dir = job_artifact_dir / "original"

    job_upload_dir.mkdir(parents=True, exist_ok=True)
    job_artifact_dir.mkdir(parents=True, exist_ok=True)
    original_artifact_dir.mkdir(parents=True, exist_ok=True)

    video_path = job_upload_dir / f"source{extension}"

    try:
        # Stream save video with size limit
        total_bytes = 0
        with video_path.open("wb") as dest:
            while True:
                chunk = video.file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {MAX_UPLOAD_SIZE // (1024 * 1024)} MB upload limit."
                    )
                dest.write(chunk)

        # 1. Build Candidate Pool
        pool_res, features_by_index = build_candidate_pool(
            video_path=str(video_path),
            out_dir=str(job_artifact_dir),
            pool_size=pool_size,
            sample_fps=sample_fps
        )

        # 2. MMR Multi-Objective Optimal Subset Selection
        selected_candidates, mmr_score, coverage_info = select_diverse_optimal_subset(
            candidates=pool_res.images,
            features_by_index=features_by_index,
            k=final_k,
            alpha=alpha,
            beta=beta,
            gamma=gamma,
            delta=delta
        )

        # 3. Re-extract chosen frames at ORIGINAL resolution from master video
        selected_indices = [c.frame_index for c in selected_candidates]
        orig_paths = extract_original_frames(
            video_path=str(video_path),
            frame_indices=selected_indices,
            out_dir=str(original_artifact_dir)
        )

        # Format candidates output
        candidates_out = []
        for img in pool_res.images:
            cand_fn = Path(img.path).name
            candidates_out.append({
                "rank": img.rank,
                "frame_index": img.frame_index,
                "timestamp_sec": img.timestamp_sec,
                "quality": img.quality,
                "sharpness": img.sharpness_raw,
                "exposure": img.exposure,
                "contrast": img.contrast,
                "detected_angle": img.detected_angle,
                "image_url": f"/artifacts/{job_id}/{cand_fn}",
                "is_hero": img.is_hero
            })

        # Format selected images output
        selected_out = []
        for img in selected_candidates:
            cand_fn = Path(img.path).name
            orig_fn = Path(orig_paths.get(img.frame_index, img.path)).name
            selected_out.append({
                "rank": img.rank,
                "frame_index": img.frame_index,
                "timestamp_sec": img.timestamp_sec,
                "quality": img.quality,
                "sharpness": img.sharpness_raw,
                "exposure": img.exposure,
                "contrast": img.contrast,
                "detected_angle": img.detected_angle,
                "image_url": f"/artifacts/{job_id}/{cand_fn}",
                "original_image_url": f"/artifacts/{job_id}/original/{orig_fn}",
                "is_hero": img.is_hero
            })

        job_data = {
            "job_id": job_id,
            "status": "COMPLETED",
            "video_path": str(video_path),
            "video_filename": video.filename,
            "file_size_bytes": total_bytes,
            "duration_sec": pool_res.duration_sec,
            "fps": pool_res.fps,
            "frames_analysed": pool_res.frames_analysed,
            "candidate_count": len(candidates_out),
            "k": final_k,
            "mmr_score": mmr_score,
            "coverage": coverage_info,
            "warnings": pool_res.warnings,
            "candidates": candidates_out,
            "selected_images": selected_out,
            "approved_images": selected_out,
            "objective_weights": {
                "alpha": alpha,
                "beta": beta,
                "gamma": gamma,
                "delta": delta
            }
        }

        _save_job_meta(job_id, job_data)

        return {
            "success": True,
            "job_id": job_id,
            "stage": "COMPLETED",
            "frames_analysed": pool_res.frames_analysed,
            "duration_seconds": pool_res.duration_sec,
            "candidate_count": len(candidates_out),
            "selected_count": len(selected_out),
            "mmr_score": mmr_score,
            "coverage": coverage_info,
            "warnings": pool_res.warnings,
            "selected_images": selected_out,
            "candidates": candidates_out
        }

    except VideoSelectionError as e:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        shutil.rmtree(job_artifact_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(e))

    except HTTPException:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        shutil.rmtree(job_artifact_dir, ignore_errors=True)
        raise

    except Exception as e:
        shutil.rmtree(job_upload_dir, ignore_errors=True)
        shutil.rmtree(job_artifact_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Video optimization failed: {str(e)}")

    finally:
        video.file.close()


# --------------------------------
# Job Status & Candidates Inspection
# --------------------------------

@app.get("/api/v1/jobs/{job_id}/status")
@app.get("/api/optimizer/jobs/{job_id}")
def get_job_status(job_id: str):
    meta = _load_job_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Optimization job not found.")
    return {
        "success": True,
        "job_id": job_id,
        "status": meta.get("status", "COMPLETED"),
        "progress_percentage": 100,
        "frames_analysed": meta.get("frames_analysed", 0),
        "duration_seconds": meta.get("duration_sec", 0.0),
        "selected_count": len(meta.get("selected_images", [])),
        "candidate_count": len(meta.get("candidates", [])),
        "coverage": meta.get("coverage", {}),
        "mmr_score": meta.get("mmr_score", 0.0)
    }


@app.get("/api/v1/jobs/{job_id}/candidates")
@app.get("/api/optimizer/jobs/{job_id}/candidates")
def get_job_candidates(job_id: str):
    meta = _load_job_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Optimization job not found.")
    return {
        "success": True,
        "job_id": job_id,
        "selected_images": meta.get("selected_images", []),
        "candidates": meta.get("candidates", []),
        "coverage": meta.get("coverage", {}),
        "warnings": meta.get("warnings", [])
    }


# --------------------------------
# Re-extract Original Resolution Frames
# --------------------------------

@app.post("/api/v1/jobs/{job_id}/extract-original")
@app.post("/api/optimizer/jobs/{job_id}/extract-original")
def extract_original_for_job(job_id: str, req: ReExtractionRequest):
    meta = _load_job_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Optimization job not found.")

    video_path = meta.get("video_path")
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Source master video no longer exists on disk.")

    original_artifact_dir = ARTIFACT_DIR / job_id / "original"
    original_artifact_dir.mkdir(parents=True, exist_ok=True)

    extracted_paths = extract_original_frames(
        video_path=video_path,
        frame_indices=req.frame_indices,
        out_dir=str(original_artifact_dir)
    )

    results = []
    for fi in req.frame_indices:
        if fi in extracted_paths:
            fn = Path(extracted_paths[fi]).name
            results.append({
                "frame_index": fi,
                "original_image_url": f"/artifacts/{job_id}/original/{fn}",
                "status": "extracted"
            })

    return {
        "success": True,
        "job_id": job_id,
        "extracted_count": len(results),
        "images": results
    }


# --------------------------------
# Image Approval & Rejection Endpoints
# --------------------------------

@app.post("/api/v1/jobs/{job_id}/approve")
@app.post("/api/optimizer/jobs/{job_id}/approve")
def approve_job_images(job_id: str, req: ApprovalRequest):
    meta = _load_job_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Optimization job not found.")

    all_candidates = {c["frame_index"]: c for c in meta.get("candidates", [])}
    approved = []

    indices = req.approved_frame_indices or [img["frame_index"] for img in meta.get("selected_images", [])]

    # Re-extract any newly approved frames if original not already present
    video_path = meta.get("video_path")
    original_artifact_dir = ARTIFACT_DIR / job_id / "original"
    original_artifact_dir.mkdir(parents=True, exist_ok=True)

    if video_path and os.path.exists(video_path):
        extract_original_frames(video_path, indices, str(original_artifact_dir))

    for rank, fi in enumerate(indices, 1):
        if fi in all_candidates:
            cand = dict(all_candidates[fi])
            cand["rank"] = rank
            cand["is_hero"] = (fi == req.hero_frame_index) if req.hero_frame_index else (rank == 1)
            cand["original_image_url"] = f"/artifacts/{job_id}/original/orig_{fi:06d}.jpg"
            approved.append(cand)

    meta["approved_images"] = approved
    meta["status"] = "APPROVED"
    _save_job_meta(job_id, meta)

    return {
        "success": True,
        "job_id": job_id,
        "status": "APPROVED",
        "approved_count": len(approved),
        "approved_images": approved
    }


@app.post("/api/v1/jobs/{job_id}/reject")
@app.post("/api/optimizer/jobs/{job_id}/reject")
def reject_job_images(job_id: str, req: RejectionRequest):
    meta = _load_job_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Optimization job not found.")

    meta["status"] = "REJECTED"
    meta["rejection_reason"] = req.reason or "Artisan requested re-capture"
    _save_job_meta(job_id, meta)

    return {
        "success": True,
        "job_id": job_id,
        "status": "REJECTED",
        "reason": meta["rejection_reason"]
    }
