import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export const rateLimiter = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 100;

  return (req: Request, res: Response, next: NextFunction): void => {
    const rawIp = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(rawIp) ? rawIp[0] : (typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '')) ||
      req.ip ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const now = Date.now();
    let entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitMap.set(ip, entry);
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

export const clearRateLimits = (): void => {
  rateLimitMap.clear();
};
