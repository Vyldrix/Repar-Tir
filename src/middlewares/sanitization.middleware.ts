import { Request, Response, NextFunction } from 'express';

/**
 * =========================================================================
 * Middleware de Saneamiento y Validación de Entradas (HU #19):
 * - Prevención de Inyecciones SQL (en conjunto con el ORM Prisma parametrizado).
 * - Prevención de Inyecciones NoSQL (detección de operadores $ y tipos anómalos).
 * - Prevención de Cross-Site Scripting (XSS) mediante escape y saneamiento de HTML.
 * - Prevención de Polución de Prototipos (__proto__, constructor, prototype).
 * - Rechazo estricto de caracteres y estructuras maliciosas (ej. bytes nulos).
 * =========================================================================
 */

// Escape de caracteres HTML para prevenir XSS
export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/javascript\s*:/gi, 'x-javascript:');
};

// Patrones característicos de inyecciones SQL maliciosas
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\b(UNION(\s+ALL)?)\b\s+SELECT\b)/i,
  /;\s*(DROP|DELETE|UPDATE|ALTER|TRUNCATE|INSERT)\s+(TABLE|FROM|INTO)?\b/i,
  /('\s*OR\s+('?[0-9a-zA-Z]+'?)\s*=\s*\2)/i,
  /("\s*OR\s+("?[0-9a-zA-Z]+"?)\s*=\s*\2)/i,
  /('\s*OR\s+[0-9]+\s*=\s*[0-9]+)/i,
  /(\bOR\b\s+['"]?1['"]?\s*=\s*['"]?1)/i,
  /('\s*--)/,
  /('\s*;\s*--)/,
];

export const containsSqlInjection = (value: string): boolean => {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
};

const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export const validateMaliciousInput = (data: unknown): ValidationResult => {
  if (data === null || data === undefined) {
    return { isValid: true };
  }

  if (typeof data === 'string') {
    // Detección de Byte Nulo
    if (data.includes('\0') || data.includes('%00')) {
      return {
        isValid: false,
        reason: 'Carácter nulo (Null Byte) no permitido',
      };
    }

    // Detección de inyección SQL
    if (containsSqlInjection(data)) {
      return {
        isValid: false,
        reason: 'Patrón de inyección SQL no permitido',
      };
    }

    return { isValid: true };
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const res = validateMaliciousInput(item);
      if (!res.isValid) return res;
    }
    return { isValid: true };
  }

  if (typeof data === 'object') {
    const keys = Object.getOwnPropertyNames(data);
    for (const key of keys) {
      // Detección de polución de prototipo
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        return {
          isValid: false,
          reason: 'Intento de polución de prototipo detectado',
        };
      }

      // Detección de operadores NoSQL (claves con prefijo $)
      if (key.startsWith('$')) {
        return {
          isValid: false,
          reason: 'Operador NoSQL no permitido en la entrada',
        };
      }

      const res = validateMaliciousInput((data as Record<string, unknown>)[key]);
      if (!res.isValid) return res;
    }
  }

  return { isValid: true };
};

export const sanitizeData = (data: unknown, currentKey = ''): unknown => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Las contraseñas no se escapan en HTML para no alterar su hash bcrypt legítimo,
    // pero ya fueron validadas contra inyecciones y bytes nulos
    if (currentKey.toLowerCase().includes('password')) {
      return data;
    }
    return escapeHtml(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, currentKey));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(key) || key.startsWith('$')) {
        continue;
      }
      sanitized[key] = sanitizeData(value, key);
    }
    return sanitized;
  }

  return data;
};

export const sanitizationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(req.url);
  } catch {
    res.status(400).json({
      message: 'Entrada maliciosa detectada: URL malformada',
    });
    return;
  }

  const urlValidation = validateMaliciousInput(decodedUrl);
  if (!urlValidation.isValid) {
    res.status(400).json({
      message: `Entrada maliciosa detectada en la petición: ${urlValidation.reason}`,
    });
    return;
  }

  // 1. Validar estrictamente contra estructuras maliciosas en body, query y params
  const bodyValidation = validateMaliciousInput(req.body);
  if (!bodyValidation.isValid) {
    res.status(400).json({
      message: `Entrada maliciosa detectada en el cuerpo: ${bodyValidation.reason}`,
    });
    return;
  }

  const queryValidation = validateMaliciousInput(req.query);
  if (!queryValidation.isValid) {
    res.status(400).json({
      message: `Entrada maliciosa detectada en parámetros de consulta: ${queryValidation.reason}`,
    });
    return;
  }

  const paramsValidation = validateMaliciousInput(req.params);
  if (!paramsValidation.isValid) {
    res.status(400).json({
      message: `Entrada maliciosa detectada en parámetros de ruta: ${paramsValidation.reason}`,
    });
    return;
  }

  // 2. Sanitizar y escapar datos antes del procesamiento en controladores
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeData(req.body) as Record<string, unknown>;
  }

  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const rec = req.query as Record<string, unknown>;
      rec[key] = sanitizeData(rec[key], key);
    }
  }

  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      const rec = req.params as Record<string, unknown>;
      rec[key] = sanitizeData(rec[key], key);
    }
  }

  next();
};
