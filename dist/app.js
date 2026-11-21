"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const buyer_routes_1 = __importDefault(require("./modules/catalogue/buyer.routes"));
const artisan_routes_1 = __importDefault(require("./modules/artisans/artisan.routes"));
const productWizard_routes_1 = __importDefault(require("./modules/products/productWizard.routes"));
const enquiry_routes_1 = __importDefault(require("./modules/enquiries/enquiry.routes"));
const commission_routes_1 = __importDefault(require("./modules/commissions/commission.routes"));
const pricing_routes_1 = __importDefault(require("./modules/pricing/pricing.routes"));
const optimizer_routes_1 = __importDefault(require("./modules/optimizer/optimizer.routes"));
const upload_routes_1 = require("./modules/upload/upload.routes");
const ai_routes_1 = require("./modules/ai/ai.routes");
const config_routes_1 = require("./modules/config/config.routes");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
// Security & Logging
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Ensure upload directories exist
const uploadsRoot = env_1.env.UPLOAD_DIR;
const videosDir = path_1.default.join(uploadsRoot, 'videos');
const framesDir = path_1.default.join(uploadsRoot, 'frames');
const productImagesDir = path_1.default.join(uploadsRoot, 'product-images');
const productVideosDir = path_1.default.join(uploadsRoot, 'product-videos');
const productDocsDir = path_1.default.join(uploadsRoot, 'product-documents');
[uploadsRoot, videosDir, framesDir, productImagesDir, productVideosDir, productDocsDir].forEach(d => {
    try {
        if (!fs_1.default.existsSync(d))
            fs_1.default.mkdirSync(d, { recursive: true });
    }
    catch (err) {
        // Graceful fallback
    }
});
// Static Uploads Serving
app.use('/uploads', express_1.default.static(uploadsRoot));
// Static Artifacts Serving (Optimizer images)
const pythonArtifactsDir = path_1.default.resolve(__dirname, '../optimizer-service/artifacts');
if (fs_1.default.existsSync(pythonArtifactsDir)) {
    app.use('/artifacts', express_1.default.static(pythonArtifactsDir));
}
app.use('/artifacts', express_1.default.static(framesDir));
// Static Frontend Serving for the Artisan Marketplace Web Application
const frontendDir = path_1.default.resolve(__dirname, '../stitch_kala_connect_artisan_marketplace 2');
if (fs_1.default.existsSync(frontendDir)) {
    app.use(express_1.default.static(frontendDir));
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
            optimizerUrl: process.env.OPTIMIZER_SERVICE_URL || env_1.env.OPTIMIZER_SERVICE_URL,
            database: 'SQLite (Prisma)',
            gemini: Boolean(env_1.env.GEMINI_API_KEY)
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
app.use('/api/pricing', pricing_routes_1.default);
app.use('/api/v1/pricing', pricing_routes_1.default);
// 2. Video Optimizer Client & Image Selection
app.use('/api/optimizer', optimizer_routes_1.default);
app.use('/api/v1/optimizer', optimizer_routes_1.default);
// 3. Media Uploads (Image, Video, Document)
app.use('/api/upload', upload_routes_1.uploadRouter);
app.use('/api/v1/upload', upload_routes_1.uploadRouter);
// 4. AI Document Analysis & Description Generation
app.use('/api/ai', ai_routes_1.aiRouter);
app.use('/api/v1/ai', ai_routes_1.aiRouter);
// 5. Configuration Status Check
app.use('/api/config', config_routes_1.configRouter);
app.use('/api/v1/config', config_routes_1.configRouter);
// 6. Auth, Buyer, Artisan, Enquiries, Commissions
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/v1/buyer', buyer_routes_1.default);
app.use('/api/buyer', buyer_routes_1.default);
app.use('/api/v1/artisan', artisan_routes_1.default);
app.use('/api/v1/artisan', productWizard_routes_1.default);
app.use('/api/artisan', artisan_routes_1.default);
app.use('/api/artisan', productWizard_routes_1.default);
app.use('/api/v1/products', productWizard_routes_1.default);
app.use('/api/products', productWizard_routes_1.default);
app.use('/api/v1/enquiries', enquiry_routes_1.default);
app.use('/api/enquiries', enquiry_routes_1.default);
app.use('/api/v1/commissions', commission_routes_1.default);
app.use('/api/commissions', commission_routes_1.default);
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
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map