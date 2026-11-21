"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizerController = void 0;
const client_1 = require("@prisma/client");
const optimizerClient_1 = require("../../services/optimizerClient");
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
class OptimizerController {
    /**
     * Upload video and generate candidate frames & diverse subset
     * POST /api/optimizer/candidates or POST /api/v1/optimizer/candidates
     */
    static async processVideo(req, res) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ success: false, error: 'Video file is required (MP4, MOV).' });
            }
            const poolSize = req.body.pool_size ? parseInt(req.body.pool_size) : 80;
            const sampleFps = req.body.sample_fps ? parseFloat(req.body.sample_fps) : 10.0;
            const finalK = req.body.final_k ? parseInt(req.body.final_k) : 5;
            const draftId = req.body.draftId || req.body.productDraftId;
            const result = await optimizerClient_1.OptimizerClient.optimizeVideo(file.path, {
                poolSize,
                sampleFps,
                finalK
            });
            // If artisan is authenticated, persist job record in database
            const artisanId = req.user?.artisanId;
            if (artisanId && draftId) {
                await prisma.videoProcessingJob.create({
                    data: {
                        id: result.job_id,
                        artisanId,
                        productDraftId: draftId,
                        videoUrl: `/uploads/videos/${path_1.default.basename(file.path)}`,
                        fileSizeBytes: file.size,
                        durationSeconds: result.duration_seconds,
                        stage: 'COMPLETED',
                        progressPercentage: 100,
                        totalFrames: result.frames_analysed,
                        framesScored: result.frames_analysed,
                        candidateFrames: JSON.stringify(result.candidates),
                        selectedImages: JSON.stringify(result.selected_images)
                    }
                }).catch((err) => console.warn('[OptimizerController] Job DB insert warning:', err.message));
                await prisma.productDraft.update({
                    where: { id: draftId },
                    data: { status: 'AI_PROCESSED' }
                }).catch(() => { });
            }
            return res.status(200).json({
                success: true,
                job_id: result.job_id,
                stage: result.stage,
                frames_analysed: result.frames_analysed,
                duration_seconds: result.duration_seconds,
                candidate_count: result.candidate_count,
                selected_count: result.selected_count,
                mmr_score: result.mmr_score,
                coverage: result.coverage,
                warnings: result.warnings,
                selected_images: result.selected_images,
                candidates: result.candidates
            });
        }
        catch (err) {
            console.error('[OptimizerController.processVideo] error:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    /**
     * Get Job Status
     * GET /api/optimizer/jobs/:jobId
     */
    static async getJobStatus(req, res) {
        try {
            const jobId = String(req.params.jobId);
            const status = await optimizerClient_1.OptimizerClient.getJobStatus(jobId);
            return res.json({
                success: true,
                job_id: jobId,
                status: status.status || 'COMPLETED',
                stage: status.stage || status.status || 'COMPLETED',
                ...status,
                data: status
            });
        }
        catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    /**
     * Get Candidate and Selected Images
     * GET /api/optimizer/jobs/:jobId/candidates
     */
    static async getCandidates(req, res) {
        try {
            const jobId = String(req.params.jobId);
            const candidates = await optimizerClient_1.OptimizerClient.getJobCandidates(jobId);
            if (candidates) {
                return res.json(candidates);
            }
            // Fallback: check database
            const dbJob = await prisma.videoProcessingJob.findUnique({
                where: { id: jobId }
            });
            if (dbJob) {
                return res.json({
                    success: true,
                    job_id: jobId,
                    selected_images: dbJob.selectedImages ? JSON.parse(dbJob.selectedImages) : [],
                    candidates: dbJob.candidateFrames ? JSON.parse(dbJob.candidateFrames) : [],
                    coverage: { requiredViews: 5, coveredViews: 5, missingViews: [], coveredList: [] }
                });
            }
            return res.status(404).json({ success: false, error: 'Job not found.' });
        }
        catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    /**
     * Approve Images
     * POST /api/optimizer/jobs/:jobId/approve
     */
    static async approveImages(req, res) {
        try {
            const jobId = String(req.params.jobId);
            const { approved_frame_indices, hero_frame_index, approvedImages } = req.body;
            const indices = approved_frame_indices || (Array.isArray(approvedImages) ? approvedImages.map((img) => img.frame_index) : undefined);
            const result = await optimizerClient_1.OptimizerClient.approveImages(jobId, indices, hero_frame_index);
            // Update database if job exists
            if (Array.isArray(result.approved_images)) {
                await prisma.videoProcessingJob.update({
                    where: { id: jobId },
                    data: {
                        stage: 'APPROVED',
                        selectedImages: JSON.stringify(result.approved_images)
                    }
                }).catch(() => { });
            }
            const count = result.approved_count || (Array.isArray(result.approved_images) ? result.approved_images.length : (indices ? indices.length : 1));
            return res.json({
                success: true,
                message: 'Images approved successfully for product listing.',
                approved_count: count,
                ...result,
                data: result
            });
        }
        catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    /**
     * Reject Job / Images
     * POST /api/optimizer/jobs/:jobId/reject
     */
    static async rejectJob(req, res) {
        try {
            const jobId = String(req.params.jobId);
            const { reason } = req.body;
            const result = await optimizerClient_1.OptimizerClient.rejectJob(jobId, reason);
            await prisma.videoProcessingJob.update({
                where: { id: jobId },
                data: { stage: 'REJECTED', errorMessage: reason }
            }).catch(() => { });
            return res.json(result);
        }
        catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
}
exports.OptimizerController = OptimizerController;
//# sourceMappingURL=optimizer.controller.js.map