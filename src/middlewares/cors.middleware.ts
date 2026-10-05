import cors, { CorsOptions } from 'cors';

/**
 * =========================================================================
 * Configuración de Políticas de CORS (HU #17):
 * - Whitelist explícita de dominios autorizados (sin comodines '*').
 * - Métodos HTTP necesarios: GET, POST, PUT, DELETE, PATCH.
 * - Encabezados requeridos: Content-Type, Authorization.
 * - Rechazo de orígenes no autorizados bajo el comportamiento estándar de CORS.
 * - Soporte para solicitudes de tipo preflight (OPTIONS).
 * =========================================================================
 */
export const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://repar-tir.com',
      'https://app.repar-tir.com',
    ];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como clientes internos, curl, móviles o tests)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Comportamiento estándar de CORS: omitir la cabecera allow-origin para orígenes no autorizados
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

export const corsMiddleware = cors(corsOptions);
