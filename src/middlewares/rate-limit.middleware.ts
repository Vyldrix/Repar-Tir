import { Request, Response, NextFunction } from 'express';

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimitAuditLog {
  timestamp: string;
  ip: string;
  identifier?: string;
  endpoint: string;
  attempts: number;
  action: 'RATE_LIMIT_EXCEEDED' | 'TEMPORARY_BLOCK_EXTENDED' | 'FAILED_LOGIN_ATTEMPT';
  details: string;
}

export const rateLimitAuditLogs: RateLimitAuditLog[] = [];

export const getRateLimitAuditLogs = (): RateLimitAuditLog[] => [...rateLimitAuditLogs];
export const clearRateLimitAuditLogs = (): void => {
  rateLimitAuditLogs.length = 0;
};

const registeredMaps: Map<string, RateLimitEntry>[] = [];

const createMap = (): Map<string, RateLimitEntry> => {
  const map = new Map<string, RateLimitEntry>();
  registeredMaps.push(map);
  return map;
};

const globalRateLimitMap = createMap();

export const getClientIp = (req: Request): string => {
  const rawIp = req.headers['x-forwarded-for'];
  return (
    (Array.isArray(rawIp)
      ? rawIp[0]
      : typeof rawIp === 'string'
        ? rawIp.split(',')[0].trim()
        : '') ||
    req.ip ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
};

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export const rateLimiter = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 100;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const now = Date.now();
    let entry = globalRateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      globalRateLimitMap.set(ip, entry);
    } else {
      entry.count++;
    }

    const remaining = Math.max(0, max - entry.count);
    const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);

    // Cabeceras estándar de Rate Limiting
    res.setHeader('RateLimit-Limit', max.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetInSeconds.toString());
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());

    if (entry.count > max) {
      res.setHeader('Retry-After', resetInSeconds.toString());
      res.status(429).json({
        message: 'Demasiadas peticiones desde esta IP. Por favor intente más tarde (Too Many Requests).',
      });
      return;
    }

    next();
  };
};

export interface LoginRateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export const createLoginRateLimiter = (options: LoginRateLimitOptions = {}) => {
  const windowMs =
    options.windowMs ||
    (process.env.LOGIN_RATE_LIMIT_WINDOW_MS
      ? Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS)
      : 15 * 60 * 1000);
  const max =
    options.max ||
    (process.env.LOGIN_RATE_LIMIT_MAX
      ? Number(process.env.LOGIN_RATE_LIMIT_MAX)
      : 5);
  const storage = createMap();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const now = Date.now();

    // Extraer identificador de usuario (email o username) del cuerpo de la petición
    let identifier: string | undefined;
    if (req.body && typeof req.body === 'object') {
      const body = req.body as Record<string, unknown>;
      if (typeof body.email === 'string' && body.email.trim() !== '') {
        identifier = body.email.trim().toLowerCase();
      } else if (typeof body.username === 'string' && body.username.trim() !== '') {
        identifier = body.username.trim().toLowerCase();
      }
    }

    // Registro por IP
    const ipKey = `ip:${ip}`;
    let ipEntry = storage.get(ipKey);
    if (!ipEntry || now > ipEntry.resetTime) {
      ipEntry = { count: 1, resetTime: now + windowMs };
      storage.set(ipKey, ipEntry);
    } else {
      ipEntry.count++;
    }

    // Registro por identificador de usuario
    let userEntry: RateLimitEntry | undefined;
    if (identifier) {
      const userKey = `user:${identifier}`;
      userEntry = storage.get(userKey);
      if (!userEntry || now > userEntry.resetTime) {
        userEntry = { count: 1, resetTime: now + windowMs };
        storage.set(userKey, userEntry);
      } else {
        userEntry.count++;
      }
    }

    const currentAttempts = Math.max(ipEntry.count, userEntry ? userEntry.count : 0);
    const remaining = Math.max(0, max - currentAttempts);
    const resetTime = Math.max(ipEntry.resetTime, userEntry ? userEntry.resetTime : 0);
    const resetInSeconds = Math.ceil((resetTime - now) / 1000);

    // Cabeceras de Rate Limiting específicas para login
    res.setHeader('RateLimit-Limit', max.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetInSeconds.toString());
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());

    // Auditoría de intentos fallidos cuando la autenticación retorna 401
    res.on('finish', () => {
      if (res.statusCode === 401) {
        rateLimitAuditLogs.push({
          timestamp: new Date().toISOString(),
          ip,
          identifier,
          endpoint: req.originalUrl || req.baseUrl + req.path || '/api/auth/login',
          attempts: currentAttempts,
          action: 'FAILED_LOGIN_ATTEMPT',
          details: `Intento de inicio de sesión fallido con credenciales inválidas para ${identifier || 'usuario desconocido'}.`,
        });
      }
    });

    if (currentAttempts > max) {
      res.setHeader('Retry-After', resetInSeconds.toString());

      // Si se detectan intentos reiterados continuos (actividad sospechosa), aplicar bloqueo temporal adicional
      if (currentAttempts >= max * 2) {
        const extendedResetTime = now + windowMs * 2;
        ipEntry.resetTime = Math.max(ipEntry.resetTime, extendedResetTime);
        if (userEntry) {
          userEntry.resetTime = Math.max(userEntry.resetTime, extendedResetTime);
        }

        rateLimitAuditLogs.push({
          timestamp: new Date().toISOString(),
          ip,
          identifier,
          endpoint: req.originalUrl || req.baseUrl + req.path || '/api/auth/login',
          attempts: currentAttempts,
          action: 'TEMPORARY_BLOCK_EXTENDED',
          details: `Actividad sospechosa persistente detectada desde IP ${ip}. Se aplicó una extensión de bloqueo temporal.`,
        });
      } else {
        rateLimitAuditLogs.push({
          timestamp: new Date().toISOString(),
          ip,
          identifier,
          endpoint: req.originalUrl || req.baseUrl + req.path || '/api/auth/login',
          attempts: currentAttempts,
          action: 'RATE_LIMIT_EXCEEDED',
          details: `Límite de intentos de login excedido (${currentAttempts}/${max}) desde IP ${ip}${identifier ? ` para el usuario ${identifier}` : ''}.`,
        });
      }

      res.status(429).json({
        message:
          options.message ||
          'Demasiados intentos de inicio de sesión desde esta IP o cuenta. Por favor intente más tarde (Too Many Requests).',
      });
      return;
    }

    next();
  };
};

export const loginRateLimiter = createLoginRateLimiter();

export const clearRateLimits = (): void => {
  for (const map of registeredMaps) {
    map.clear();
  }
  clearRateLimitAuditLogs();
};
