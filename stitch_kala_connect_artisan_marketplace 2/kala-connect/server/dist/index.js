"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./routes/config");
const upload_1 = require("./routes/upload");
const ai_1 = require("./routes/ai");
const pricing_1 = require("./routes/pricing");
// Load environment variables
dotenv_1.default.config();
// Also attempt loading from parent root if present
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3005;
// CORS setup
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Static uploads serving
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
app.use('/uploads', express_1.default.static(uploadsDir));
// Route mounting
app.use('/api/config', config_1.configRouter);
app.use('/api/upload', upload_1.uploadRouter);
app.use('/api/ai', ai_1.aiRouter);
app.use('/api/pricing', pricing_1.pricingRouter);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Kala Connect Server',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
app.listen(PORT, () => {
    console.log(`========================================================`);
    console.log(`🚀 Kala Connect Backend Server running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`⚙️ Config Status: http://localhost:${PORT}/api/config/status`);
    console.log(`========================================================`);
});
