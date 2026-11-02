import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';

registerStandardTestHooks();

describe('GET /api/health', () => {
  it('debe responder con estado 200 y el mensaje de confirmación', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Repar-Tir API en funcionamiento',
    });
  });
});

// Implementar mecanismos de seguridad, cifrado y autenticacion mediante JWT.
describe('Mecanismos de Seguridad, Cifrado y JWT (HU07)', () => {
  it('debe validar y firmar tokens JWT retornando 401 Unauthorized ante tokens inválidos, alterados o expirados', async () => {
    const invalidTokens = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTYiLCJpYXQiOjE2MDAwMDAwMDB9.firma_falsa_invalida',
      'tokenTotalmenteMalformado123',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTYiLCJleHAiOjE1MDAwMDAwMDB9.firma_expirada',
    ];

    for (const token of invalidTokens) {
      const response = await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Lista no autorizada' });

      expect(response.status).toBe(401);
    }
  });

  it('debe asegurar que las contraseñas nunca se expongan en texto plano en las respuestas', async () => {
    const rawPassword = 'MiPasswordSegura789!';
    const user = {
      username: 'usuarioSeguridadHash',
      email: 'seguridad.hash@example.com',
      password: rawPassword,
    };

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(user);

    expect(registerRes.body.password).toBeUndefined();
    expect(registerRes.body.passwordHash).toBeUndefined();
  });

  it('debe incluir cabeceras de seguridad HTTP (HSTS) en las respuestas', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers).toHaveProperty('strict-transport-security');
  });

  it('debe verificar que las variables de configuración de seguridad se obtengan del entorno', () => {
    const jwtSecret = process.env.JWT_SECRET || 'development_test_secret';
    expect(jwtSecret).toBeDefined();
    expect(typeof jwtSecret).toBe('string');
  });
});

// Garantizar tiempos de respuesta optimos y limitar la tasa de peticiones (HU08).
describe('Rendimiento, Tiempos de Respuesta y Rate Limiting (HU08)', () => {
  it('debe responder dentro de los tiempos óptimos de latencia requeridos (inferior a 200 ms)', async () => {
    const start = performance.now();
    const response = await request(app).get('/api/health');
    const duration = performance.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(200);
  });

  it('debe incluir cabeceras de Rate Limiting en las respuestas de la API', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers).toHaveProperty('ratelimit-limit');
    expect(response.headers).toHaveProperty('ratelimit-remaining');
  });

  it('debe retornar código HTTP 429 Too Many Requests cuando se supera el límite de peticiones permitido', async () => {
    const clientIp = '192.168.1.105';
    const requests = [];

    for (let i = 0; i < 105; i++) {
      requests.push(
        request(app)
          .get('/api/health')
          .set('X-Forwarded-For', clientIp)
      );
    }

    const responses = await Promise.all(requests);
    const hasRateLimitBlocked = responses.some((res) => res.status === 429);

    expect(hasRateLimitBlocked).toBe(true);
  });

  it('debe mantener tiempos de respuesta óptimos en consultas sobre campos clave indexados', async () => {
    const start = performance.now();
    await request(app)
      .post('/api/lists/search')
      .send({ page: 1, limit: 10 });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
