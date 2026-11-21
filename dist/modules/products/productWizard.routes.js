"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const productWizard_controller_1 = require("./productWizard.controller");
const auth_1 = require("../../middleware/auth");
const env_1 = require("../../config/env");
const router = (0, express_1.Router)();
// Ensure upload directory exists
const videoUploadDir = path_1.default.resolve(env_1.env.UPLOAD_DIR, 'videos');
if (!fs_1.default.existsSync(videoUploadDir)) {
    fs_1.default.mkdirSync(videoUploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, videoUploadDir),
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname) || '.mp4';
        cb(null, `craft_video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/') || file.originalname.endsWith('.mp4') || file.originalname.endsWith('.mov')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only video files (MP4, MOV) are allowed'));
        }
    }
});
// Direct Product Creation
router.post('/products', auth_1.optionalAuthenticate, productWizard_controller_1.ProductWizardController.createDirectProduct);
router.post('/', auth_1.optionalAuthenticate, productWizard_controller_1.ProductWizardController.createDirectProduct);
// Step 1: Facts & Price
router.post('/products/draft', auth_1.authenticate, productWizard_controller_1.ProductWizardController.saveDraft);
router.get('/products/draft/:draftId', auth_1.authenticate, productWizard_controller_1.ProductWizardController.getDraft);
// Step 2: Video upload
router.post('/products/:draftId/video-upload', auth_1.authenticate, upload.single('video'), productWizard_controller_1.ProductWizardController.uploadVideo);
// Step 3: AI Processing & Live status polling
router.post('/jobs/start-processing', auth_1.authenticate, productWizard_controller_1.ProductWizardController.startProcessing);
router.get('/jobs/:jobId/status', auth_1.authenticate, productWizard_controller_1.ProductWizardController.getJobStatus);
// Step 4: Candidate frames & approval
router.get('/jobs/:jobId/candidates', auth_1.authenticate, productWizard_controller_1.ProductWizardController.getCandidates);
router.post('/jobs/:jobId/approve-images', auth_1.authenticate, productWizard_controller_1.ProductWizardController.approveImages);
// Step 5: Fact-grounded AI review & publishing
router.get('/products/:draftId/ai-review', auth_1.authenticate, productWizard_controller_1.ProductWizardController.getAiReview);
router.post('/products/:draftId/publish', auth_1.authenticate, productWizard_controller_1.ProductWizardController.publishProduct);
exports.default = router;
//# sourceMappingURL=productWizard.routes.js.map