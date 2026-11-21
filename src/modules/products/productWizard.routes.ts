import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ProductWizardController } from './productWizard.controller';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
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
    cb(null, `craft_video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.originalname.endsWith('.mp4') || file.originalname.endsWith('.mov')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MOV) are allowed'));
    }
  }
});

// Direct Product Creation
router.post('/products', optionalAuthenticate, ProductWizardController.createDirectProduct);
router.post('/', optionalAuthenticate, ProductWizardController.createDirectProduct);

// Step 1: Facts & Price
router.post('/products/draft', authenticate, ProductWizardController.saveDraft);
router.get('/products/draft/:draftId', authenticate, ProductWizardController.getDraft);

// Step 2: Video upload
router.post('/products/:draftId/video-upload', authenticate, upload.single('video'), ProductWizardController.uploadVideo);

// Step 3: AI Processing & Live status polling
router.post('/jobs/start-processing', authenticate, ProductWizardController.startProcessing);
router.get('/jobs/:jobId/status', authenticate, ProductWizardController.getJobStatus);

// Step 4: Candidate frames & approval
router.get('/jobs/:jobId/candidates', authenticate, ProductWizardController.getCandidates);
router.post('/jobs/:jobId/approve-images', authenticate, ProductWizardController.approveImages);

// Step 5: Fact-grounded AI review & publishing
router.get('/products/:draftId/ai-review', authenticate, ProductWizardController.getAiReview);
router.post('/products/:draftId/publish', authenticate, ProductWizardController.publishProduct);

export default router;
