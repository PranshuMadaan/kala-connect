import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const defaultUploadDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.resolve(__dirname, '../../uploads');

const defaultDbUrl = process.env.VERCEL
  ? (process.env.DATABASE_URL || 'file:/tmp/dev.db')
  : (process.env.DATABASE_URL || 'file:./dev.db');

const envSchema = z.object({
  NODE_ENV: z.string().default(process.env.NODE_ENV || 'production'),
  PORT: z.union([z.string(), z.number()]).default(process.env.PORT || '5000').transform(v => Number(v)),
  DATABASE_URL: z.string().default(defaultDbUrl),
  JWT_SECRET: z.string().default(process.env.JWT_SECRET || 'kala_connect_super_secret_jwt_key_2026_dev'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  GEMINI_API_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().default(defaultUploadDir),
  CORS_ORIGIN: z.string().default('*'),
  OPTIMIZER_SERVICE_URL: z.string().default(process.env.OPTIMIZER_SERVICE_URL || 'http://localhost:8000'),
});

export const env = envSchema.parse(process.env);
