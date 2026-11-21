"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const server = app_1.default.listen(env_1.env.PORT, '0.0.0.0', () => {
    console.log('=======================================================');
    console.log(`🌸 Kala Connect Backend API Server Live!`);
    console.log(`🚀 Port:         ${env_1.env.PORT}`);
    console.log(`🩺 Health check: http://localhost:${env_1.env.PORT}/health`);
    console.log(`📖 API Docs:     http://localhost:${env_1.env.PORT}/api/v1/docs`);
    console.log(`🗄️ Database:     ${env_1.env.DATABASE_URL}`);
    console.log(`📂 Uploads:      ${env_1.env.UPLOAD_DIR}`);
    console.log(`🌍 Environment:  ${env_1.env.NODE_ENV}`);
    console.log('=======================================================');
});
const handleShutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        console.log('Kala Connect API server closed.');
        process.exit(0);
    });
};
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
exports.default = server;
//# sourceMappingURL=server.js.map