"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const optimizer_controller_1 = require("./optimizer.controller");
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
        cb(null, `craft_opt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp4|mov|m4v|webm|avi|mkv)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only video files (MP4, MOV, WEBM) are supported by the optimizer.'));
        }
    }
});
// Candidate generation and multi-objective optimization
router.post('/candidates', auth_1.optionalAuthenticate, upload.single('video'), optimizer_controller_1.OptimizerController.processVideo);
// Job status & candidates
router.get('/jobs/:jobId', optimizer_controller_1.OptimizerController.getJobStatus);
router.get('/jobs/:jobId/candidates', optimizer_controller_1.OptimizerController.getCandidates);
// Image approval & rejection
router.post('/jobs/:jobId/approve', auth_1.optionalAuthenticate, optimizer_controller_1.OptimizerController.approveImages);
router.post('/jobs/:jobId/reject', auth_1.optionalAuthenticate, optimizer_controller_1.OptimizerController.rejectJob);
exports.default = router;
//# sourceMappingURL=optimizer.routes.js.map