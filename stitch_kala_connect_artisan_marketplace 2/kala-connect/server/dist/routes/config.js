"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRouter = void 0;
const express_1 = require("express");
exports.configRouter = (0, express_1.Router)();
exports.configRouter.get('/status', (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    const geminiApiKey = process.env.GEMINI_API_KEY || '';
    const isSupabaseConfigured = supabaseUrl.length > 0 &&
        supabaseAnonKey.length > 0 &&
        !supabaseUrl.includes('your-project') &&
        !supabaseAnonKey.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    const isGeminiConfigured = geminiApiKey.length > 0 &&
        !geminiApiKey.includes('AIzaSy...') &&
        geminiApiKey.startsWith('AIza');
    res.json({
        status: 'ok',
        integrations: {
            supabase: {
                configured: isSupabaseConfigured,
                url: isSupabaseConfigured ? supabaseUrl : null
            },
            gemini: {
                configured: isGeminiConfigured
            }
        },
        message: !isSupabaseConfigured || !isGeminiConfigured
            ? 'Some external services require configuration in .env. Review README_BACKEND_SETUP.md for instructions.'
            : 'All services successfully configured.'
    });
});
