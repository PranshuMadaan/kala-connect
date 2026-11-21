import app from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('=======================================================');
  console.log(`🌸 Kala Connect Backend API Server Live!`);
  console.log(`🚀 Port:         ${env.PORT}`);
  console.log(`🩺 Health check: http://localhost:${env.PORT}/health`);
  console.log(`📖 API Docs:     http://localhost:${env.PORT}/api/v1/docs`);
  console.log(`🗄️ Database:     ${env.DATABASE_URL}`);
  console.log(`📂 Uploads:      ${env.UPLOAD_DIR}`);
  console.log(`🌍 Environment:  ${env.NODE_ENV}`);
  console.log('=======================================================');
});

const handleShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('Kala Connect API server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
