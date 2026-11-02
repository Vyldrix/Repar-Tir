import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';

registerStandardTestHooks();

// Desarrollar la logica de registro.
describe('POST /api/auth/register', () => {
  it('debe responder con estado 201 y retornar el objeto del usuario creado sin datos sensibles', async () => {
    const newUser = {
      username: 'usuarioTest',
      email: 'test@example.com',
      password: 'passwordSeguro123',
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(newUser);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      username: newUser.username,
      email: newUser.email,
    });
    expect(response.body.password).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('debe retornar error 400 si faltan campos obligatorios', async () => {
    const payloadsIncompletos = [
      { username: 'usuarioSinEmail', password: 'password123' },
      { email: 'sinusername@example.com', password: 'password123' },
      { username: 'usuarioSinPass', email: 'sinpass@example.com' },
    ];

    for (const payload of payloadsIncompletos) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(payload);
      expect(response.status).toBe(400);
    }
  });

  it('debe retornar error 400 si los campos no cumplen con los formatos requeridos', async () => {
    const payloadsInvalidos = [
      { username: 'usuarioFormato', email: 'correo-no-valido', password: 'password123' },
      { username: 'usuarioFormato', email: 'formato@example.com', password: '123' },
    ];

    for (const payload of payloadsInvalidos) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(payload);
      expect(response.status).toBe(400);
    }
  });

  it('debe retornar un error adecuado si el correo electrónico ya se encuentra registrado', async () => {
    const userOriginal = {
      username: 'usuarioOriginalEmail',
      email: 'duplicado.email@example.com',
      password: 'password123',
    };

    await request(app).post('/api/auth/register').send(userOriginal);

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'otroUsuarioDistinto',
        email: userOriginal.email,
        password: 'otraPassword123',
      });

    expect([400, 409]).toContain(response.status);
    expect(response.body).toHaveProperty('message');
  });

  it('debe retornar un error adecuado si el nombre de usuario ya se encuentra registrado', async () => {
    const userOriginal = {
      username: 'usuarioDuplicadoUser',
      email: 'original.user@example.com',
      password: 'password123',
    };

    await request(app).post('/api/auth/register').send(userOriginal);

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: userOriginal.username,
        email: 'otro.email@example.com',
        password: 'otraPassword123',
      });

    expect([400, 409]).toContain(response.status);
    expect(response.body).toHaveProperty('message');
  });
});

// Desarrollar la logica de inicio de sesion.
describe('POST /api/auth/login', () => {
  const registeredUser = {
    username: 'loginUser',
    email: 'login.user@example.com',
    password: 'passwordSeguro123',
  };

  it('debe responder con estado 200 Ok y token cuando las credenciales son válidas (por email o username)', async () => {
    await request(app).post('/api/auth/register').send(registeredUser);

    // Login con email
    const resEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: registeredUser.email, password: registeredUser.password });

    expect(resEmail.status).toBe(200);
    expect(resEmail.body).toHaveProperty('token');
    const user = resEmail.body.user ?? resEmail.body;
    expect(user.password).toBeUndefined();
    expect(user.passwordHash).toBeUndefined();

    // Login con username
    const resUsername = await request(app)
      .post('/api/auth/login')
      .send({ username: registeredUser.username, password: registeredUser.password });

    expect(resUsername.status).toBe(200);
  });

  it('debe retornar error 400 si faltan campos obligatorios o el formato de email es inválido', async () => {
    const payloadsInvalidos = [
      { email: 'usuario@example.com' },
      { password: 'password123' },
      {},
      { email: 'correo-sin-formato', password: 'password123' },
    ];

    for (const payload of payloadsInvalidos) {
      const response = await request(app)
        .post('/api/auth/login')
        .send(payload);
      expect(response.status).toBe(400);
    }
  });

  it('debe retornar un error adecuado si el usuario no existe o la contraseña no coincide', async () => {
    const user = {
      username: 'usuarioTestLoginFail',
      email: 'login.fail@example.com',
      password: 'passwordCorrecta123',
    };

    await request(app).post('/api/auth/register').send(user);

    // Usuario no registrado
    const resNoExiste = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no.registrado@example.com', password: 'password123' });
    expect([400, 401, 404]).toContain(resNoExiste.status);
    expect(resNoExiste.body).toHaveProperty('message');

    // Contraseña incorrecta
    const resPassIncorrecta = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'passwordEquivocada' });
    expect([400, 401]).toContain(resPassIncorrecta.status);
    expect(resPassIncorrecta.body).toHaveProperty('message');
  });
});

// Seguridad: Cierre de Sesión y Revocación Comprobable de Credenciales (HU27)
describe('POST /api/auth/logout - Cierre de sesión y revocación de tokens (HU27)', () => {
  it('debe revocar el refresh token en POST /api/auth/logout e impedir su reutilización en POST /refresh (HTTP 403)', async () => {
    const user = {
      username: 'userLogoutHU27',
      email: 'logout.hu27@example.com',
      password: 'password123',
    };
    await request(app).post('/api/auth/register').send(user);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    const { refreshToken, accessToken } = loginRes.body;

    // 1. Verificar que el refresh token es válido antes de cerrar sesión
    const refreshBefore = await request(app)
      .post('/refresh')
      .send({ refreshToken });
    expect(refreshBefore.status).toBe(200);

    // 2. Cerrar sesión y revocar el token
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    // 3. Intentar reutilizar el refresh token revocado en POST /refresh -> HTTP 403 Forbidden
    const refreshAfter = await request(app)
      .post('/refresh')
      .send({ refreshToken });
    expect(refreshAfter.status).toBe(403);
    expect(refreshAfter.body.message).toMatch(/revocado/i);

    // 4. Intentar usar el access token revocado en una ruta protegida -> HTTP 401 Unauthorized
    const listAfterLogout = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Intento post-logout' });
    expect(listAfterLogout.status).toBe(401);
  });

  it('debe retornar HTTP 400 si no se envía refresh token ni token de autorización a revocar', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(400);
  });
});
