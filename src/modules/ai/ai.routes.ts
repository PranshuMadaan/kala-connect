import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GeminiListingService } from '../../services/gemini';
import { extractDocumentText } from '../../services/docExtraction';

export const aiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * POST /api/ai/analyze-document
 */
aiRouter.post('/analyze-document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let text = req.body?.text || '';
    let filename = req.body?.filename || 'Document';

    if (req.file) {
      filename = req.file.originalname;
      const extraction = await extractDocumentText(req.file.buffer, req.file.mimetype, filename);
      text = extraction.text;
    }

    if (!text) {
      return res.status(400).json({ error: 'No text or document provided for analysis.' });
    }

    const analysis = await GeminiListingService.analyzeDocument(text, filename);
    return res.json({
      success: true,
      analysis
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/generate-description
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

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required.' });
    }

    const data = await GeminiListingService.generateProductNarrative({
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
