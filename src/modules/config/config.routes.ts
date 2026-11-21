import { Router, Request, Response } from 'express';
import { env } from '../../config/env';
import { OptimizerClient } from '../../services/optimizerClient';

export const configRouter = Router();

configRouter.get('/status', async (req: Request, res: Response) => {
  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.startsWith('AIza'));
  const isOptimizerHealthy = await OptimizerClient.checkHealth();

  return res.json({
    status: 'ok',
    service: 'Kala Connect Unified Backend',
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
        type: 'SQLite'
      }
    },
    message: isOptimizerHealthy
      ? 'All backend microservices operational.'
      : 'FastAPI optimizer is currently offline; local fallback engine is active.'
  });
});
