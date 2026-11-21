"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const env_1 = require("../../config/env");
const docExtraction_1 = require("../../services/docExtraction");
const gemini_1 = require("../../services/gemini");
exports.uploadRouter = (0, express_1.Router)();
// Ensure local directories exist
const uploadsBase = env_1.env.UPLOAD_DIR;
const imagesDir = path_1.default.join(uploadsBase, 'product-images');
const videosDir = path_1.default.join(uploadsBase, 'product-videos');
const docsDir = path_1.default.join(uploadsBase, 'product-documents');
[imagesDir, videosDir, docsDir].forEach(d => {
    if (!fs_1.default.existsSync(d))
        fs_1.default.mkdirSync(d, { recursive: true });
});
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith('video/'))
            cb(null, videosDir);
        else if (file.mimetype.startsWith('image/'))
            cb(null, imagesDir);
        else
            cb(null, docsDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname) || '';
        const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        cb(null, safeName);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});
/**
 * POST /api/upload/image
 */
exports.uploadRouter.post('/image', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        const publicUrl = `/uploads/product-images/${req.file.filename}`;
        return res.json({
            success: true,
            url: publicUrl,
            filename: req.file.originalname,
            size: req.file.size
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Image upload failed' });
    }
});
/**
 * POST /api/upload/video
 */
exports.uploadRouter.post('/video', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }
        const publicUrl = `/uploads/product-videos/${req.file.filename}`;
        return res.json({
            success: true,
            url: publicUrl,
            filename: req.file.originalname,
            size: req.file.size
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Video upload failed' });
    }
});
/**
 * POST /api/upload/document
 */
exports.uploadRouter.post('/document', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document file uploaded' });
        }
        const publicUrl = `/uploads/product-documents/${req.file.filename}`;
        const fileBuffer = fs_1.default.readFileSync(req.file.path);
        // Extract text
        const extraction = await (0, docExtraction_1.extractDocumentText)(fileBuffer, req.file.mimetype, req.file.originalname);
        let aiAnalysis = null;
        if (req.query.autoAnalyze === 'true') {
            aiAnalysis = await gemini_1.GeminiListingService.analyzeDocument(extraction.text, req.file.originalname);
        }
        return res.json({
            success: true,
            file: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                url: publicUrl
            },
            extraction: {
                textSnippet: extraction.text.slice(0, 1000),
                fullTextLength: extraction.text.length,
                method: extraction.method
            },
            aiAnalysis
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Document upload failed' });
    }
});
//# sourceMappingURL=upload.routes.js.map