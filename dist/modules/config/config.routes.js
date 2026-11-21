"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRouter = void 0;
const express_1 = require("express");
const env_1 = require("../../config/env");
const optimizerClient_1 = require("../../services/optimizerClient");
exports.configRouter = (0, express_1.Router)();
exports.configRouter.get('/status', async (req, res) => {
    const isGeminiConfigured = Boolean(env_1.env.GEMINI_API_KEY && env_1.env.GEMINI_API_KEY.startsWith('AIza'));
    const isOptimizerHealthy = await optimizerClient_1.OptimizerClient.checkHealth();
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
                url: env_1.env.OPTIMIZER_SERVICE_URL
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
//# sourceMappingURL=config.routes.js.map