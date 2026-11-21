"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const storageService_1 = require("../services/storageService");
const docExtractionService_1 = require("../services/docExtractionService");
const aiService_1 = require("../services/aiService");
exports.uploadRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max limit
    }
});
// Allowed MIME types
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_DOC_MIMES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
];
/**
 * POST /api/upload/image
 * Handles single product image upload.
 */
exports.uploadRouter.post('/image', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        if (!ALLOWED_IMAGE_MIMES.includes(req.file.mimetype.toLowerCase())) {
            return res.status(400).json({
                error: `Invalid file type: ${req.file.mimetype}. Only JPG, PNG, and WEBP images are permitted.`
            });
        }
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image file exceeds maximum 10MB limit.' });
        }
        const result = await (0, storageService_1.uploadFile)(req.file.buffer, 'product-images', req.file.originalname, req.file.mimetype);
        res.json({
            success: true,
            url: result.url,
            storagePath: result.storagePath,
            provider: result.provider,
            filename: req.file.originalname,
            size: req.file.size
        });
    }
    catch (err) {
        console.error('Image upload error:', err);
        res.status(500).json({ error: err.message || 'Image upload failed' });
    }
});
/**
 * POST /api/upload/video
 * Handles craft video upload.
 */
exports.uploadRouter.post('/video', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }
        if (!ALLOWED_VIDEO_MIMES.includes(req.file.mimetype.toLowerCase())) {
            return res.status(400).json({
                error: `Invalid video format: ${req.file.mimetype}. Only MP4, MOV, and WEBM videos are permitted.`
            });
        }
        if (req.file.size > 100 * 1024 * 1024) {
            return res.status(400).json({ error: 'Video exceeds maximum 100MB limit.' });
        }
        const result = await (0, storageService_1.uploadFile)(req.file.buffer, 'product-videos', req.file.originalname, req.file.mimetype);
        res.json({
            success: true,
            url: result.url,
            storagePath: result.storagePath,
            provider: result.provider,
            filename: req.file.originalname,
            size: req.file.size
        });
    }
    catch (err) {
        console.error('Video upload error:', err);
        res.status(500).json({ error: err.message || 'Video upload failed' });
    }
});
/**
 * POST /api/upload/document
 * Handles supporting craft document upload, extraction, and optional immediate AI analysis.
 */
exports.uploadRouter.post('/document', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file uploaded' });
        }
        const lowerName = req.file.originalname.toLowerCase();
        const isDocx = lowerName.endsWith('.docx');
        const isPdf = lowerName.endsWith('.pdf');
        const isImage = /\.(jpe?g|png|webp)$/i.test(lowerName);
        if (!ALLOWED_DOC_MIMES.includes(req.file.mimetype.toLowerCase()) && !isDocx && !isPdf && !isImage) {
            return res.status(400).json({
                error: `Invalid file format: ${req.file.mimetype}. Allowed: PDF, DOCX, JPG, PNG, WEBP.`
            });
        }
        if (req.file.size > 20 * 1024 * 1024) {
            return res.status(400).json({ error: 'Document file exceeds maximum 20MB limit.' });
        }
        // 1. Upload to storage
        const uploadResult = await (0, storageService_1.uploadFile)(req.file.buffer, 'product-documents', req.file.originalname, req.file.mimetype);
        // 2. Extract plain text
        let extraction = null;
        try {
            extraction = await (0, docExtractionService_1.extractDocumentText)(req.file.buffer, req.file.mimetype, req.file.originalname);
        }
        catch (extractErr) {
            console.warn('Text extraction warning:', extractErr.message);
        }
        // 3. Optional AI analysis if autoAnalyze query param is true and Gemini is configured
        let aiAnalysis = null;
        if (req.query.autoAnalyze === 'true') {
            try {
                if (extraction && extraction.text) {
                    aiAnalysis = await (0, aiService_1.analyzeDocumentWithAI)(extraction.text, req.file.originalname);
                }
                else if (isImage) {
                    aiAnalysis = await (0, aiService_1.analyzeDocumentWithAI)('', req.file.originalname, req.file.buffer, req.file.mimetype);
                }
            }
            catch (aiErr) {
                console.warn('AI Document Analysis failed:', aiErr.message);
                aiAnalysis = {
                    error: aiErr.message,
                    configured: false
                };
            }
        }
        res.json({
            success: true,
            file: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                url: uploadResult.url,
                storagePath: uploadResult.storagePath
            },
            extraction: extraction ? {
                textSnippet: extraction.text.slice(0, 1000),
                fullTextLength: extraction.text.length,
                pageCount: extraction.pageCount,
                method: extraction.method
            } : null,
            aiAnalysis
        });
    }
    catch (err) {
        console.error('Document upload error:', err);
        res.status(500).json({ error: err.message || 'Document upload failed' });
    }
});
