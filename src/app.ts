import express, { Express, Request, Response } from 'express';
import cors from 'cors';

const app: Express = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint de verificación de salud del servicio
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Repar-Tir API en funcionamiento',
  });
});

export default app;
