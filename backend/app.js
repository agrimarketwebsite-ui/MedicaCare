// backend/app.js
// Express app factory: middleware pipeline → routes → error handlers.
// Order matters: security headers → CORS → body parsing → request log → rate
// limit → routes → notFound → errorHandler (dapat laging huli). Sa behind-proxy
// deployment (Vercel/NGINX), ang trust proxy ay tumutugma sa X-Forwarded-For
// para TAMA ang client IP na nakikita ng rate limiter (hindi lahat iisang IP).

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import corsMiddleware from './config/cors.js';
import requestLogger from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(corsMiddleware);
  // 1mb: sapat sa lahat ng JSON payloads ngayon; ang avatar uploads (base64,
  // ~1.4MB encoded para sa 1MB file) ay route-specific limit kapag nai-implement
  // na (docs/STORAGE_DESIGN.md §3).
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser()); // kailangan ng /api/auth/refresh para basahin ang httpOnly cookie
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);

  app.use('/api', apiLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;

