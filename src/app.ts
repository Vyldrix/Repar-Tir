import express, { Express, Request, Response } from 'express';
import authRouter from './routes/auth.routes.js';
import listRouter from './routes/list.routes.js';
import { corsMiddleware } from './middlewares/cors.middleware.js';
import { rateLimiter } from './middlewares/rate-limit.middleware.js';

const app: Express = express();

// Middlewares de seguridad, rate limiting y parsing
app.use(corsMiddleware);
app.use(express.json());

// Cabeceras de seguridad (HSTS / HTTPS y protección)
app.use((_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Límite de peticiones por IP (Rate Limiting)
app.use(rateLimiter({ windowMs: 60 * 1000, max: 100 }));

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/lists', listRouter);

// Endpoint de verificación de salud del servicio
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Repar-Tir API en funcionamiento',
  });
});

export default app;
