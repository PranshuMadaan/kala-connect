import { Router, Request, Response } from 'express';
import { env } from '../../config/env';
import { OptimizerClient } from '../../services/optimizerClient';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const configRouter = Router();

configRouter.get('/status', async (req: Request, res: Response) => {
  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.startsWith('AIza'));
  const isOptimizerHealthy = await OptimizerClient.checkHealth();

  let dbStats = { connected: false, productsCount: 0, benchmarksCount: 0, type: 'SQLite (Prisma dev.db)' };
  try {
    const [pCount, bCount] = await Promise.all([
      prisma.product.count(),
      prisma.marketBenchmark.count()
    ]);
    dbStats.connected = true;
    dbStats.productsCount = pCount;
    dbStats.benchmarksCount = bCount;
  } catch (e) {
    dbStats.connected = false;
  }

  return res.json({
    status: 'ok',
    service: 'Kala Connect Unified Backend',
    backend: {
      connected: true,
      version: '2.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      port: env.PORT
    },
    integrations: {
      gemini: {
        configured: isGeminiConfigured
      },
      optimizer: {
        configured: true,
        healthy: isOptimizerHealthy,
        url: env.OPTIMIZER_SERVICE_URL
      },
      database: {
        configured: true,
        connected: dbStats.connected,
        type: 'SQLite (Prisma)',
        productsCount: dbStats.productsCount,
        benchmarksCount: dbStats.benchmarksCount
      },
      supabase: {
        configured: Boolean(process.env.SUPABASE_URL),
        url: process.env.SUPABASE_URL || ''
      }
    },
    message: isOptimizerHealthy
      ? 'All backend microservices operational.'
      : 'FastAPI optimizer is currently offline; local fallback engine is active.'
  });
});
