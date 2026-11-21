"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const gemini_1 = require("../../services/gemini");
const docExtraction_1 = require("../../services/docExtraction");
exports.aiRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});
/**
 * POST /api/ai/analyze-document
 */
exports.aiRouter.post('/analyze-document', upload.single('file'), async (req, res) => {
    try {
        let text = req.body?.text || '';
        let filename = req.body?.filename || 'Document';
        if (req.file) {
            filename = req.file.originalname;
            const extraction = await (0, docExtraction_1.extractDocumentText)(req.file.buffer, req.file.mimetype, filename);
            text = extraction.text;
        }
        if (!text) {
            return res.status(400).json({ error: 'No text or document provided for analysis.' });
        }
        const analysis = await gemini_1.GeminiListingService.analyzeDocument(text, filename);
        return res.json({
            success: true,
            analysis
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/ai/generate-description
 */
exports.aiRouter.post('/generate-description', async (req, res) => {
    try {
        const { title, category, technique, materials, time_taken_days, village, state, dimensions, is_gi_tagged, custom_orders_accepted, tone, documentFacts } = req.body;
        if (!title || !category) {
            return res.status(400).json({ error: 'Title and category are required.' });
        }
        const data = await gemini_1.GeminiListingService.generateProductNarrative({
            title,
            category,
            technique,
            materials: materials || 'Traditional craft materials',
            time_taken_days: Number(time_taken_days) || 3,
            village,
            state,
            dimensions,
            is_gi_tagged: Boolean(is_gi_tagged),
            custom_orders_accepted: Boolean(custom_orders_accepted),
            tone: tone || 'heritage',
            documentFacts
        });
        return res.json({
            success: true,
            data
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
//# sourceMappingURL=ai.routes.js.map