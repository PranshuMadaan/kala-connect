import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { configRouter } from './routes/config';
import { uploadRouter } from './routes/upload';
import { aiRouter } from './routes/ai';
import { pricingRouter } from './routes/pricing';

// Load environment variables
dotenv.config();
// Also attempt loading from parent root if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3005;

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads serving
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Route mounting
app.use('/api/config', configRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/ai', aiRouter);
app.use('/api/pricing', pricingRouter);

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
