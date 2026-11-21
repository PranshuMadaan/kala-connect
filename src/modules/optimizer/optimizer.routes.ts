import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { OptimizerController } from './optimizer.controller';
import { optionalAuthenticate } from '../../middleware/auth';
import { env } from '../../config/env';

const router = Router();

// Ensure upload directory exists
const videoUploadDir = path.resolve(env.UPLOAD_DIR, 'videos');
if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `craft_opt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp4|mov|m4v|webm|avi|mkv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MOV, WEBM) are supported by the optimizer.'));
    }
  }
});

// Candidate generation and multi-objective optimization
router.post('/candidates', optionalAuthenticate, upload.single('video'), OptimizerController.processVideo);

// Job status & candidates
router.get('/jobs/:jobId', OptimizerController.getJobStatus);
router.get('/jobs/:jobId/candidates', OptimizerController.getCandidates);

// Image approval & rejection
router.post('/jobs/:jobId/approve', optionalAuthenticate, OptimizerController.approveImages);
router.post('/jobs/:jobId/reject', optionalAuthenticate, OptimizerController.rejectJob);

export default router;
