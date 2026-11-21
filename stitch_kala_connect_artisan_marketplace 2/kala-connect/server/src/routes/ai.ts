import { Router, Request, Response } from 'express';
import multer from 'multer';
import { analyzeDocumentWithAI, generateProductNarrativeWithAI } from '../services/aiService';
import { extractDocumentText } from '../services/docExtractionService';

export const aiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * POST /api/ai/analyze-document
 * Accepts either:
 * 1. JSON payload with { text, filename }
 * 2. Multipart form-data with a 'file'
 */
aiRouter.post('/analyze-document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let text = req.body?.text || '';
    let filename = req.body?.filename || 'Uploaded Document';
    let imageBuffer: Buffer | undefined;
    let mimeType: string | undefined;

    if (req.file) {
      filename = req.file.originalname;
      mimeType = req.file.mimetype;
      const lower = filename.toLowerCase();

      if (mimeType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(lower)) {
        imageBuffer = req.file.buffer;
      } else {
        const extraction = await extractDocumentText(req.file.buffer, req.file.mimetype, req.file.originalname);
        text = extraction.text;
      }
    }

    if (!text && !imageBuffer) {
      return res.status(400).json({
        error: 'No text or valid document provided for AI analysis.'
      });
    }

    const analysis = await analyzeDocumentWithAI(text, filename, imageBuffer, mimeType);
    res.json({
      success: true,
      analysis
    });
  } catch (err: any) {
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
aiRouter.post('/generate-description', async (req: Request, res: Response) => {
  try {
    const {
      title,
      category,
      technique,
      materials,
      time_taken_days,
      village,
      state,
      dimensions,
      is_gi_tagged,
      custom_orders_accepted,
      tone,
      documentFacts
    } = req.body;

    if (!title || !materials || !category) {
      return res.status(400).json({
        error: 'Product title, craft category, and raw materials are mandatory for AI narrative synthesis.'
      });
    }

    const narrative = await generateProductNarrativeWithAI({
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
  } catch (err: any) {
    console.error('AI Description Generation Error:', err);
    const isApiKeyError = err.message && err.message.includes('GEMINI_API_KEY');
    res.status(isApiKeyError ? 400 : 500).json({
      error: err.message || 'AI Description Generation failed',
      requiresApiKey: isApiKeyError
    });
  }
});
