"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const aiService_1 = require("../services/aiService");
const docExtractionService_1 = require("../services/docExtractionService");
exports.aiRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});
/**
 * POST /api/ai/analyze-document
 * Accepts either:
 * 1. JSON payload with { text, filename }
 * 2. Multipart form-data with a 'file'
 */
exports.aiRouter.post('/analyze-document', upload.single('file'), async (req, res) => {
    try {
        let text = req.body?.text || '';
        let filename = req.body?.filename || 'Uploaded Document';
        let imageBuffer;
        let mimeType;
        if (req.file) {
            filename = req.file.originalname;
            mimeType = req.file.mimetype;
            const lower = filename.toLowerCase();
            if (mimeType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(lower)) {
                imageBuffer = req.file.buffer;
            }
            else {
                const extraction = await (0, docExtractionService_1.extractDocumentText)(req.file.buffer, req.file.mimetype, req.file.originalname);
                text = extraction.text;
            }
        }
        if (!text && !imageBuffer) {
            return res.status(400).json({
                error: 'No text or valid document provided for AI analysis.'
            });
        }
        const analysis = await (0, aiService_1.analyzeDocumentWithAI)(text, filename, imageBuffer, mimeType);
        res.json({
            success: true,
            analysis
        });
    }
    catch (err) {
        console.error('AI Document Analysis Error:', err);
        const isApiKeyError = err.message && err.message.includes('GEMINI_API_KEY');
        res.status(isApiKeyError ? 400 : 500).json({
            error: err.message || 'AI Document Analysis failed',
            requiresApiKey: isApiKeyError
        });
    }
});
/**
 * POST /api/ai/generate-description
 * Takes real artisan inputs and calls Gemini to synthesize narrative and Hindi translation.
 */
exports.aiRouter.post('/generate-description', async (req, res) => {
    try {
        const { title, category, technique, materials, time_taken_days, village, state, dimensions, is_gi_tagged, custom_orders_accepted, tone, documentFacts } = req.body;
        if (!title || !materials || !category) {
            return res.status(400).json({
                error: 'Product title, craft category, and raw materials are mandatory for AI narrative synthesis.'
            });
        }
        const narrative = await (0, aiService_1.generateProductNarrativeWithAI)({
            title,
            category,
            technique,
            materials,
            time_taken_days: Number(time_taken_days) || 1,
            village,
            state,
            dimensions,
            is_gi_tagged: Boolean(is_gi_tagged),
            custom_orders_accepted: Boolean(custom_orders_accepted),
            tone: tone || 'heritage',
            documentFacts
        });
        res.json({
            success: true,
            data: narrative
        });
    }
    catch (err) {
        console.error('AI Description Generation Error:', err);
        const isApiKeyError = err.message && err.message.includes('GEMINI_API_KEY');
        res.status(isApiKeyError ? 400 : 500).json({
            error: err.message || 'AI Description Generation failed',
            requiresApiKey: isApiKeyError
        });
    }
});
