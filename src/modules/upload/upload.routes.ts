import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';
import { extractDocumentText } from '../../services/docExtraction';
import { GeminiListingService } from '../../services/gemini';

export const uploadRouter = Router();

// Ensure local directories exist
const uploadsBase = env.UPLOAD_DIR;
const imagesDir = path.join(uploadsBase, 'product-images');
const videosDir = path.join(uploadsBase, 'product-videos');
const docsDir = path.join(uploadsBase, 'product-documents');

[imagesDir, videosDir, docsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, videosDir);
    else if (file.mimetype.startsWith('image/')) cb(null, imagesDir);
    else cb(null, docsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

/**
 * POST /api/upload/image
 */
uploadRouter.post('/image', upload.single('file'), (req: Request, res: Response) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

/**
 * POST /api/upload/video
 */
uploadRouter.post('/video', upload.single('file'), (req: Request, res: Response) => {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Video upload failed' });
  }
});

/**
 * POST /api/upload/document
 */
uploadRouter.post('/document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded' });
    }

    const publicUrl = `/uploads/product-documents/${req.file.filename}`;
    const fileBuffer = fs.readFileSync(req.file.path);

    // Extract text
    const extraction = await extractDocumentText(fileBuffer, req.file.mimetype, req.file.originalname);

    let aiAnalysis = null;
    if (req.query.autoAnalyze === 'true') {
      aiAnalysis = await GeminiListingService.analyzeDocument(extraction.text, req.file.originalname);
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Document upload failed' });
  }
});
