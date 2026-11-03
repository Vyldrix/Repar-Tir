import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import * as grpc from '@grpc/grpc-js';
import app from '../src/app.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';
import {
  startAuthGrpcServer,
  stopAuthGrpcServer,
  createAuthGrpcClient,
  setGoogleTokenVerifier,
  resetGoogleTokenVerifier,
  GoogleTokenPayload,
  GrpcAuthResponse,
} from '../src/grpc/auth.grpc.js';

registerStandardTestHooks();

describe('Autenticación con Google mediante gRPC (TDD)', () => {
  let grpcPort: number;

  beforeAll(async () => {
    // Levantar el servidor gRPC en un puerto dinámico (0) para pruebas aisladas
    grpcPort = await startAuthGrpcServer(0);
  });

  afterAll(async () => {
    resetGoogleTokenVerifier();
    await stopAuthGrpcServer();
  });

  beforeEach(() => {
    // Configurar un verificador simulado determinista para tokens de Google
    setGoogleTokenVerifier(async (idToken: string): Promise<GoogleTokenPayload> => {
      if (idToken === 'valid-google-token-new-user') {
        return {
          sub: 'google-uid-1001',
          email: 'nuevo.usuario@gmail.com',
          name: 'Nuevo Usuario Gmail',
          email_verified: true,
        };
      }
      if (idToken === 'valid-google-token-existing-email') {
        return {
          sub: 'google-uid-2002',
          email: 'existente@gmail.com',
          name: 'Usuario Existente',
          email_verified: true,
        };
      }
      throw new Error('Token de Google inválido o expirado');
    });
  });

  describe('1. Servicio gRPC puro (AuthService.LoginWithGoogle)', () => {
    it('debe autenticar un token válido de Gmail por gRPC, registrar al usuario y emitir JWT y RefreshToken', async () => {
      const client = createAuthGrpcClient(`localhost:${grpcPort}`);

      const response = await new Promise<GrpcAuthResponse>((resolve, reject) => {
        client.LoginWithGoogle(
          { id_token: 'valid-google-token-new-user' },
          (err: grpc.ServiceError | null, res: GrpcAuthResponse) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      });

      expect(response).toBeDefined();
      expect(response.message).toContain('Inicio de sesión con Google exitoso');
      expect(response.token).toEqual(expect.any(String));
      expect(response.access_token).toEqual(expect.any(String));
      expect(response.refresh_token).toEqual(expect.any(String));
      expect(response.user).toMatchObject({
        id: expect.any(String),
        email: 'nuevo.usuario@gmail.com',
        username: expect.stringContaining('nuevousuariogmail'),
      });
    });

    it('debe retornar código gRPC INVALID_ARGUMENT cuando no se envía id_token', async () => {
      const client = createAuthGrpcClient(`localhost:${grpcPort}`);

      await expect(
        new Promise((resolve, reject) => {
          client.LoginWithGoogle(
            { id_token: '' },
            (err: grpc.ServiceError | null, res: GrpcAuthResponse) => {
              if (err) return reject(err);
              resolve(res);
            }
          );
        })
      ).rejects.toMatchObject({
        code: grpc.status.INVALID_ARGUMENT,
      });
    });

    it('debe retornar código gRPC UNAUTHENTICATED cuando el token de Google es inválido', async () => {
      const client = createAuthGrpcClient(`localhost:${grpcPort}`);

      await expect(
        new Promise((resolve, reject) => {
          client.LoginWithGoogle(
            { id_token: 'token-falso-o-vencido' },
            (err: grpc.ServiceError | null, res: GrpcAuthResponse) => {
              if (err) return reject(err);
              resolve(res);
            }
          );
        })
      ).rejects.toMatchObject({
        code: grpc.status.UNAUTHENTICATED,
      });
    });
  });

  describe('2. Integración API Gateway Express -> Cliente gRPC (POST /api/auth/google)', () => {
    it('debe iniciar sesión vía HTTP llamando internamente al servidor gRPC y permitir acceder a rutas protegidas', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ idToken: 'valid-google-token-new-user' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: expect.stringContaining('Google'),
        token: expect.any(String),
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'nuevo.usuario@gmail.com',
        },
      });

      // Verificar que el JWT emitido sirve para operar en Repar-Tir (ej: buscar listas)
      const listsRes = await request(app)
        .post('/api/lists/search')
        .set('Authorization', `Bearer ${res.body.token}`)
        .send({});

      expect(listsRes.status).toBe(200);
    });

    it('debe vincular la cuenta si el usuario ya se había registrado previamente con su correo y contraseña', async () => {
      // 1. Registro tradicional
      const regRes = await request(app).post('/api/auth/register').send({
        username: 'usuarioPrevio',
        email: 'existente@gmail.com',
        password: 'password123',
      });
      expect(regRes.status).toBe(201);

      // 2. Login con Google usando el mismo email
      const googleRes = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid-google-token-existing-email' });

      expect(googleRes.status).toBe(200);
      expect(googleRes.body.user.id).toBe(regRes.body.id);
      expect(googleRes.body.user.username).toBe('usuarioPrevio');
      expect(googleRes.body.user.email).toBe('existente@gmail.com');
    });

    it('debe responder 400 Bad Request si no se proporciona idToken ni credential', async () => {
      const res = await request(app).post('/api/auth/google').send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('debe responder 401 Unauthorized si Google rechaza el token', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ idToken: 'token-invalido' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('debe incluir únicamente el contenedor del botón oficial de Google (gRPC) en el Frontend', async () => {
      const htmlRes = await request(app).get('/app');
      expect(htmlRes.status).toBe(200);
      expect(htmlRes.text).toContain('https://accounts.google.com/gsi/client');
      expect(htmlRes.text).toContain('id="googleGsiButtonContainer"');
      expect(htmlRes.text).not.toContain('id="btnGoogleLogin"');

      const jsRes = await request(app).get('/app/app.js');
      expect(jsRes.status).toBe(200);
      expect(jsRes.text).toContain('loginWithGoogleGrpc');
      expect(jsRes.text).toContain('/api/auth/google');
      expect(jsRes.text).toContain('google.accounts.id.initialize');
    });

    it('debe exponer GET /api/auth/google/config con el clientId configurado en el entorno', async () => {
      process.env.GOOGLE_CLIENT_ID = '123456789-test.apps.googleusercontent.com';
      const res = await request(app).get('/api/auth/google/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        clientId: '123456789-test.apps.googleusercontent.com',
        grpcEnabled: true,
      });
      delete process.env.GOOGLE_CLIENT_ID;
    });
  });
});
