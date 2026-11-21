import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import buyerRoutes from './modules/catalogue/buyer.routes';
import artisanRoutes from './modules/artisans/artisan.routes';
import productWizardRoutes from './modules/products/productWizard.routes';
import enquiryRoutes from './modules/enquiries/enquiry.routes';
import commissionRoutes from './modules/commissions/commission.routes';
import pricingRoutes from './modules/pricing/pricing.routes';
import optimizerRoutes from './modules/optimizer/optimizer.routes';
import { uploadRouter } from './modules/upload/upload.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { configRouter } from './modules/config/config.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Security & Logging
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directories exist
const uploadsRoot = env.UPLOAD_DIR;
const videosDir = path.join(uploadsRoot, 'videos');
const framesDir = path.join(uploadsRoot, 'frames');
const productImagesDir = path.join(uploadsRoot, 'product-images');
const productVideosDir = path.join(uploadsRoot, 'product-videos');
const productDocsDir = path.join(uploadsRoot, 'product-documents');

[uploadsRoot, videosDir, framesDir, productImagesDir, productVideosDir, productDocsDir].forEach(d => {
  try {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  } catch (err) {
    // Graceful fallback
  }
});

// Static Uploads Serving
app.use('/uploads', express.static(uploadsRoot));

// Static Artifacts Serving (Optimizer images)
const pythonArtifactsDir = path.resolve(__dirname, '../optimizer-service/artifacts');
if (fs.existsSync(pythonArtifactsDir)) {
  app.use('/artifacts', express.static(pythonArtifactsDir));
}
app.use('/artifacts', express.static(framesDir));

// Static Frontend Serving for the Artisan Marketplace Web Application
const frontendDir = path.resolve(__dirname, '../stitch_kala_connect_artisan_marketplace 2');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
}

// Health Check Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Kala Connect Production Backend API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    integrations: {
      optimizerUrl: process.env.OPTIMIZER_SERVICE_URL || env.OPTIMIZER_SERVICE_URL,
      database: 'SQLite (Prisma)',
      gemini: Boolean(env.GEMINI_API_KEY)
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Kala Connect Server',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Core Microservice Routes (Support both /api/* and /api/v1/* for full frontend compatibility)
// 1. Pricing Engine & Market Price Setter
app.use('/api/pricing', pricingRoutes);
app.use('/api/v1/pricing', pricingRoutes);

// 2. Video Optimizer Client & Image Selection
app.use('/api/optimizer', optimizerRoutes);
app.use('/api/v1/optimizer', optimizerRoutes);

// 3. Media Uploads (Image, Video, Document)
app.use('/api/upload', uploadRouter);
app.use('/api/v1/upload', uploadRouter);

// 4. AI Document Analysis & Description Generation
app.use('/api/ai', aiRouter);
app.use('/api/v1/ai', aiRouter);

// 5. Configuration Status Check
app.use('/api/config', configRouter);
app.use('/api/v1/config', configRouter);

// 6. Auth, Buyer, Artisan, Enquiries, Commissions
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/v1/buyer', buyerRoutes);
app.use('/api/buyer', buyerRoutes);

app.use('/api/v1/artisan', artisanRoutes);
app.use('/api/v1/artisan', productWizardRoutes);
app.use('/api/artisan', artisanRoutes);
app.use('/api/artisan', productWizardRoutes);

app.use('/api/v1/products', productWizardRoutes);
app.use('/api/products', productWizardRoutes);

app.use('/api/v1/enquiries', enquiryRoutes);
app.use('/api/enquiries', enquiryRoutes);

app.use('/api/v1/commissions', commissionRoutes);
app.use('/api/commissions', commissionRoutes);

// Interactive OpenAPI / API Documentation Route
app.get('/api/v1/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Kala Connect Backend API Documentation</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
        <style>
          body { max-width: 900px; margin: 0 auto; padding: 2rem; }
          .endpoint { margin: 1.5rem 0; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
          .method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; color: #fff; }
          .get { background-color: #2e7d32; }
          .post { background-color: #1565c0; }
          code { font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>🌸 Kala Connect Backend API (v1) & v2.0 Microservices</h1>
        <p>Production-grade backend for Kala Connect Artisan Marketplace with integrated AI Video Optimizer and Market Price Setter.</p>
        
        <h2>AI Market Price Setter</h2>
        <div class="endpoint">
          <span class="method post">POST</span> <code>/api/v1/pricing/recommend</code>
          <p>Calculates transparent cost-plus price breakdown and matches against authentic craft benchmarks to produce Minimum Viable, Recommended, and Premium pricing tiers.</p>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span> <code>/api/pricing/calculate</code>
          <p>Quick mathematical cost calculator distinguishing margin vs markup.</p>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span> <code>/api/v1/pricing/benchmarks</code>
          <p>Lists verified handicraft market benchmarks across craft clusters.</p>
        </div>

        <h2>Video-to-Image Optimizer</h2>
        <div class="endpoint">
          <span class="method post">POST</span> <code>/api/optimizer/candidates</code>
          <p>Upload video to FastAPI optimizer engine. Performs multi-objective MMR selection: S* = argmax [αQ(S) + βC(S) + γD(S) - δR(S)] and re-extracts at original resolution.</p>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span> <code>/api/optimizer/jobs/:jobId/candidates</code>
          <p>Returns candidate frames pool, quality scores, detected angles, and original-resolution extracted photos.</p>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span> <code>/api/optimizer/jobs/:jobId/approve</code>
          <p>Artisan approves final photo selection and sets cover image.</p>
        </div>

        <h2>Authentication & Marketplace</h2>
        <div class="endpoint">
          <span class="method post">POST</span> <code>/api/v1/auth/request-otp</code>
          <p>Request passwordless 6-digit OTP.</p>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span> <code>/api/v1/auth/verify-otp</code>
          <p>Verify OTP and receive JWT access token.</p>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span> <code>/api/v1/buyer/products</code>
          <p>Faceted craft catalog with fair price guarantee and loom proof.</p>
        </div>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use(errorHandler);

export default app;
