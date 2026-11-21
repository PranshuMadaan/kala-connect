import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadFile } from '../services/storageService';
import { extractDocumentText } from '../services/docExtractionService';
import { analyzeDocumentWithAI } from '../services/aiService';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
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
uploadRouter.post('/image', upload.single('file'), async (req: Request, res: Response) => {
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

    const result = await uploadFile(
      req.file.buffer,
      'product-images',
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      url: result.url,
      storagePath: result.storagePath,
      provider: result.provider,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (err: any) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

/**
 * POST /api/upload/video
 * Handles craft video upload.
 */
uploadRouter.post('/video', upload.single('file'), async (req: Request, res: Response) => {
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

    const result = await uploadFile(
      req.file.buffer,
      'product-videos',
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      url: result.url,
      storagePath: result.storagePath,
      provider: result.provider,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (err: any) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: err.message || 'Video upload failed' });
  }
});

/**
 * POST /api/upload/document
 * Handles supporting craft document upload, extraction, and optional immediate AI analysis.
 */
uploadRouter.post('/document', upload.single('file'), async (req: Request, res: Response) => {
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
    const uploadResult = await uploadFile(
      req.file.buffer,
      'product-documents',
      req.file.originalname,
      req.file.mimetype
    );

    // 2. Extract plain text
    let extraction = null;
    try {
      extraction = await extractDocumentText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (extractErr: any) {
      console.warn('Text extraction warning:', extractErr.message);
    }

    // 3. Optional AI analysis if autoAnalyze query param is true and Gemini is configured
    let aiAnalysis = null;
    if (req.query.autoAnalyze === 'true') {
      try {
        if (extraction && extraction.text) {
          aiAnalysis = await analyzeDocumentWithAI(extraction.text, req.file.originalname);
        } else if (isImage) {
          aiAnalysis = await analyzeDocumentWithAI('', req.file.originalname, req.file.buffer, req.file.mimetype);
        }
      } catch (aiErr: any) {
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
  } catch (err: any) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: err.message || 'Document upload failed' });
  }
});
