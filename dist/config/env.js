"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
dotenv_1.default.config();
const defaultUploadDir = process.env.VERCEL
    ? path_1.default.join('/tmp', 'uploads')
    : path_1.default.resolve(__dirname, '../../uploads');
const defaultDbUrl = process.env.VERCEL
    ? (process.env.DATABASE_URL || 'file:/tmp/dev.db')
    : (process.env.DATABASE_URL || 'file:./dev.db');
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().default(process.env.NODE_ENV || 'production'),
    PORT: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).default(process.env.PORT || '5000').transform(v => Number(v)),
    DATABASE_URL: zod_1.z.string().default(defaultDbUrl),
    JWT_SECRET: zod_1.z.string().default(process.env.JWT_SECRET || 'kala_connect_super_secret_jwt_key_2026_dev'),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().default('30d'),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    UPLOAD_DIR: zod_1.z.string().default(defaultUploadDir),
    CORS_ORIGIN: zod_1.z.string().default('*'),
    OPTIMIZER_SERVICE_URL: zod_1.z.string().default(process.env.OPTIMIZER_SERVICE_URL || 'http://localhost:8000'),
});
exports.env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map