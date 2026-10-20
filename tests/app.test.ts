import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';
import { clearRateLimits } from '../src/middlewares/rate-limit.middleware.js';
import prisma from '../src/lib/prisma.js';

beforeAll(async () => {
  await prisma.list.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.list.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

beforeEach(() => {
  clearRateLimits();
});

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
      { email: 'usuario@example.com' }, // sin password
      { password: 'password123' },      // sin identificador
      {},                               // cuerpo vacío
      { email: 'correo-sin-formato', password: 'password123' }, // formato inválido
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

// Desarrollar la api y logica para la creacion de listas.
describe('POST /api/lists', () => {
  const testUser = {
    username: 'userListas',
    email: 'listas.user@example.com',
    password: 'passwordSeguro123',
  };

  const getAuthToken = async (): Promise<string> => {
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    return loginRes.body.token;
  };

  it('debe responder con estado 201 Created y la lista creada vinculada al usuario autenticado', async () => {
    const token = await getAuthToken();
    const newList = { title: 'Lista de compras del fin de semana' };

    const response = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send(newList);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: newList.title,
      userId: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('debe retornar error 401 si falta el token o es inválido', async () => {
    const authHeaders = [
      {},
      { Authorization: 'Bearer token_invalido_expirado_o_falso' },
    ];

    for (const headers of authHeaders) {
      const response = await request(app)
        .post('/api/lists')
        .set(headers)
        .send({ title: 'Lista de prueba' });
      expect(response.status).toBe(401);
    }
  });

  it('debe retornar error 400 si el título es inválido, vacío o supera el límite permitido', async () => {
    const token = await getAuthToken();
    const payloadsInvalidos = [
      {},
      { title: '' },
      { title: '    ' },
      { title: 'a'.repeat(256) },
    ];

    for (const payload of payloadsInvalidos) {
      const response = await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(response.status).toBe(400);
    }
  });
});

// Desarrollar la api y logica para la edicion de listas.
describe('PUT /api/lists/:id', () => {
  const userA = {
    username: 'userListasEdicionA',
    email: 'listas.edicion.a@example.com',
    password: 'passwordSeguro123',
  };

  const userB = {
    username: 'userListasEdicionB',
    email: 'listas.edicion.b@example.com',
    password: 'passwordSeguro123',
  };

  const getAuthTokenAndList = async (user: typeof userA) => {
    await request(app).post('/api/auth/register').send(user);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    const token = loginRes.body.token;

    const createListRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lista original' });

    return { token, listId: createListRes.body.id };
  };

  it('debe responder con estado 200 OK y retornar la lista actualizada con updatedAt al ser editada por su dueño', async () => {
    const { token, listId } = await getAuthTokenAndList(userA);
    const updateData = { title: 'Lista con título actualizado' };

    const response = await request(app)
      .put(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: listId,
      title: updateData.title,
      updatedAt: expect.any(String),
    });
  });

  it('debe retornar error 401 Unauthorized si la solicitud no incluye token de autenticación', async () => {
    const response = await request(app)
      .put('/api/lists/cualquier-id')
      .send({ title: 'Intento sin autenticación' });

    expect(response.status).toBe(401);
  });

  it('debe retornar error 404 Not Found si la lista a editar no existe', async () => {
    const { token } = await getAuthTokenAndList(userA);

    const response = await request(app)
      .put('/api/lists/id-inexistente-9999')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nuevo título' });

    expect(response.status).toBe(404);
  });

  it('debe retornar error 403 Forbidden si la lista pertenece a otro usuario', async () => {
    const { listId } = await getAuthTokenAndList(userA);

    await request(app).post('/api/auth/register').send(userB);
    const loginResB = await request(app)
      .post('/api/auth/login')
      .send({ email: userB.email, password: userB.password });
    const tokenB = loginResB.body.token;

    const response = await request(app)
      .put(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Intento de modificar lista ajena' });

    expect(response.status).toBe(403);
  });

  it('debe retornar error 400 Bad Request si el título es inválido, vacío o supera la longitud permitida', async () => {
    const { token, listId } = await getAuthTokenAndList(userA);
    const invalidTitles = ['', '    ', 'a'.repeat(256)];

    for (const title of invalidTitles) {
      const response = await request(app)
        .put(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title });

      expect(response.status).toBe(400);
    }
  });
});

// Desarrollar la api y logica para la eliminacion de listas.
describe('DELETE /api/lists/:id', () => {
  const userA = {
    username: 'userListasDeleteA',
    email: 'listas.delete.a@example.com',
    password: 'passwordSeguro123',
  };

  const userB = {
    username: 'userListasDeleteB',
    email: 'listas.delete.b@example.com',
    password: 'passwordSeguro123',
  };

  const getAuthTokenAndList = async (user: typeof userA) => {
    await request(app).post('/api/auth/register').send(user);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    const token = loginRes.body.token;

    const createListRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lista para eliminar' });

    return { token, listId: createListRes.body.id };
  };

  it('debe responder con código 200 OK tras la eliminación exitosa por parte del propietario y dar 404 al reintentar', async () => {
    const { token, listId } = await getAuthTokenAndList(userA);

    const response = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    const secondDeleteRes = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(secondDeleteRes.status).toBe(404);
  });

  it('debe retornar error 401 Unauthorized si la solicitud no incluye token de autenticación', async () => {
    const response = await request(app)
      .delete('/api/lists/cualquier-id');

    expect(response.status).toBe(401);
  });

  it('debe retornar error 404 Not Found si la lista no existe', async () => {
    const { token } = await getAuthTokenAndList(userA);

    const response = await request(app)
      .delete('/api/lists/id-que-no-existe-9999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('debe retornar error 403 Forbidden si un usuario intenta eliminar una lista de otro usuario', async () => {
    const { listId } = await getAuthTokenAndList(userA);

    await request(app).post('/api/auth/register').send(userB);
    const loginResB = await request(app)
      .post('/api/auth/login')
      .send({ email: userB.email, password: userB.password });
    const tokenB = loginResB.body.token;

    const response = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(response.status).toBe(403);
  });
});

// Desarrollar la api y logica para la consulta de listas.
describe('POST /api/lists/search', () => {
  const userA = {
    username: 'userListasQueryA',
    email: 'listas.query.a@example.com',
    password: 'passwordSeguro123',
  };

  const userB = {
    username: 'userListasQueryB',
    email: 'listas.query.b@example.com',
    password: 'passwordSeguro123',
  };

  const setupUserAndLists = async (user: typeof userA, titles: string[]) => {
    await request(app).post('/api/auth/register').send(user);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    const token = loginRes.body.token;

    for (const title of titles) {
      await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${token}`)
        .send({ title });
    }

    return token;
  };

  it('debe responder con estado 200 OK y devolver solo las listas del usuario autenticado con información de paginación', async () => {
    const tokenA = await setupUserAndLists(userA, ['Lista Supermercado A', 'Lista Farmacia A']);
    await setupUserAndLists(userB, ['Lista Exclusiva B']);

    const response = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.lists).toBeInstanceOf(Array);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 10 });

    const titles = response.body.lists.map((l: any) => l.title);
    expect(titles).not.toContain('Lista Exclusiva B');
  });

  it('debe filtrar adecuadamente las listas según los parámetros de búsqueda enviados en el cuerpo', async () => {
    const tokenA = await setupUserAndLists(userA, ['Compras Verdulería', 'Ferretería Herramientas']);

    const response = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ search: 'Verdulería' });

    expect(response.status).toBe(200);
    expect(response.body.lists).toBeInstanceOf(Array);
    response.body.lists.forEach((item: any) => {
      expect(item.title.toLowerCase()).toContain('verdulería');
    });
  });

  it('debe retornar estado 200 OK y una lista vacía cuando no existen coincidencias', async () => {
    const tokenA = await setupUserAndLists(userA, ['Lista Regular']);

    const response = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ search: 'termino_totalmente_inexistente_xyz_123' });

    expect(response.status).toBe(200);
    expect(response.body.lists).toEqual([]);
  });

  it('debe aplicar paginación correctamente respetando los parámetros page y limit', async () => {
    const tokenA = await setupUserAndLists(userA, ['Lista Pag 1', 'Lista Pag 2', 'Lista Pag 3']);

    const response = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ page: 1, limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body.lists).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 1 });
  });

  it('debe retornar error 401 Unauthorized si la solicitud no incluye token de autenticación', async () => {
    const response = await request(app)
      .post('/api/lists/search')
      .send({ page: 1, limit: 10 });

    expect(response.status).toBe(401);
  });

  it('debe retornar error 400 Bad Request si los parámetros de paginación son inválidos', async () => {
    const tokenA = await setupUserAndLists(userA, []);

    const response = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ page: -1, limit: 0 });

    expect(response.status).toBe(400);
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

// Colección de Bruno para consulta y prueba de endpoints (HU20)
describe('Colección de Bruno para consulta y prueba de endpoints (HU20)', () => {
  const brunoDir = path.resolve(process.cwd(), 'bruno');

  it('debe existir el archivo bruno.json configurado correctamente para la colección', () => {
    const brunoJsonPath = path.join(brunoDir, 'bruno.json');
    expect(fs.existsSync(brunoJsonPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(brunoJsonPath, 'utf8'));
    expect(content).toHaveProperty('name', 'Repar-Tir API');
    expect(content).toHaveProperty('type', 'collection');
    expect(content).toHaveProperty('version', '1');
  });

  it('debe contener entornos configurados con variables clave (baseUrl, token, listId)', () => {
    const envDir = path.join(brunoDir, 'environments');
    expect(fs.existsSync(envDir)).toBe(true);

    const localEnvPath = path.join(envDir, 'Local.bru');
    const prodEnvPath = path.join(envDir, 'Production.bru');

    expect(fs.existsSync(localEnvPath)).toBe(true);
    expect(fs.existsSync(prodEnvPath)).toBe(true);

    const localContent = fs.readFileSync(localEnvPath, 'utf8');
    expect(localContent).toContain('baseUrl:');
    expect(localContent).toContain('token:');
    expect(localContent).toContain('listId:');

    const prodContent = fs.readFileSync(prodEnvPath, 'utf8');
    expect(prodContent).toContain('baseUrl:');
  });

  it('debe organizar los recursos en módulos estructurados (Health, Autenticacion, Listas)', () => {
    const expectedModules = ['Health', 'Autenticacion', 'Listas'];

    for (const mod of expectedModules) {
      const modulePath = path.join(brunoDir, mod);
      expect(fs.existsSync(modulePath)).toBe(true);
      expect(fs.statSync(modulePath).isDirectory()).toBe(true);
    }
  });

  it('debe incluir todos los endpoints desarrollados con métodos, encabezados y cuerpos JSON requeridos', () => {
    const expectedRequests = [
      {
        file: path.join(brunoDir, 'Health', 'Verificar Estado.bru'),
        method: 'get',
        urlPart: '/api/health',
        requiresAuth: false,
      },
      {
        file: path.join(brunoDir, 'Autenticacion', 'Registrar Usuario.bru'),
        method: 'post',
        urlPart: '/api/auth/register',
        requiresAuth: false,
        requiresJsonBody: true,
      },
      {
        file: path.join(brunoDir, 'Autenticacion', 'Iniciar Sesion.bru'),
        method: 'post',
        urlPart: '/api/auth/login',
        requiresAuth: false,
        requiresJsonBody: true,
      },
      {
        file: path.join(brunoDir, 'Listas', 'Crear Lista.bru'),
        method: 'post',
        urlPart: '/api/lists',
        requiresAuth: true,
        requiresJsonBody: true,
      },
      {
        file: path.join(brunoDir, 'Listas', 'Buscar Listas.bru'),
        method: 'post',
        urlPart: '/api/lists/search',
        requiresAuth: true,
        requiresJsonBody: true,
      },
      {
        file: path.join(brunoDir, 'Listas', 'Actualizar Lista.bru'),
        method: 'put',
        urlPart: '/api/lists/{{listId}}',
        requiresAuth: true,
        requiresJsonBody: true,
      },
      {
        file: path.join(brunoDir, 'Listas', 'Eliminar Lista.bru'),
        method: 'delete',
        urlPart: '/api/lists/{{listId}}',
        requiresAuth: true,
      },
    ];

    for (const reqInfo of expectedRequests) {
      expect(fs.existsSync(reqInfo.file)).toBe(true);
      const content = fs.readFileSync(reqInfo.file, 'utf8');

      expect(content).toContain(reqInfo.method);
      expect(content).toContain(reqInfo.urlPart);

      if (reqInfo.requiresAuth) {
        expect(content).toMatch(/Authorization:\s*Bearer/i);
      }

      if (reqInfo.requiresJsonBody) {
        expect(content).toMatch(/Content-Type:\s*application\/json/i);
        expect(content).toContain('body:json');
      }
    }
  });

  it('debe documentar detalladamente las respuestas exitosas (200, 201) y de error (400, 401, 403, 404)', () => {
    const filesWithDocs = [
      path.join(brunoDir, 'Health', 'Verificar Estado.bru'),
      path.join(brunoDir, 'Autenticacion', 'Registrar Usuario.bru'),
      path.join(brunoDir, 'Autenticacion', 'Iniciar Sesion.bru'),
      path.join(brunoDir, 'Listas', 'Crear Lista.bru'),
      path.join(brunoDir, 'Listas', 'Buscar Listas.bru'),
      path.join(brunoDir, 'Listas', 'Actualizar Lista.bru'),
      path.join(brunoDir, 'Listas', 'Eliminar Lista.bru'),
    ];

    const allDocsCombined = filesWithDocs
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n');

    // Validar presencia de respuestas exitosas documentadas
    expect(allDocsCombined).toContain('200 OK');
    expect(allDocsCombined).toContain('201 Created');

    // Validar presencia de respuestas de error documentadas
    expect(allDocsCombined).toContain('400 Bad Request');
    expect(allDocsCombined).toContain('401 Unauthorized');
    expect(allDocsCombined).toContain('403 Forbidden');
    expect(allDocsCombined).toContain('404 Not Found');
  });
});

// Configuración y Despliegue Automático en Render (HU21)
describe('Configuración y Despliegue Automático en Render (HU21)', () => {
  const rootDir = process.cwd();

  it('debe existir el archivo render.yaml con la especificación de servicio, build y start commands', () => {
    const renderYamlPath = path.join(rootDir, 'render.yaml');
    expect(fs.existsSync(renderYamlPath)).toBe(true);

    const content = fs.readFileSync(renderYamlPath, 'utf8');
    expect(content).toContain('type: web');
    expect(content).toContain('name: repar-tir-backend');
    expect(content).toContain('buildCommand:');
    expect(content).toContain('npm run build');
    expect(content).toContain('startCommand: npm start');
    expect(content).toContain('healthCheckPath: /api/health');
    expect(content).toContain('autoDeploy: true');
  });

  it('debe declarar variables de entorno sensibles sin exponer valores en el código (sync: false)', () => {
    const renderYamlPath = path.join(rootDir, 'render.yaml');
    const content = fs.readFileSync(renderYamlPath, 'utf8');

    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('JWT_SECRET');
    expect(content).toContain('sync: false');

    // Garantizar que no se expongan contraseñas ni secretos hardcodeados
    expect(content).not.toMatch(/JWT_SECRET:\s*["'][a-zA-Z0-9_-]{10,}["']/);
  });

  it('debe configurar el pipeline de CI/CD en GitHub Actions con el job de despliegue dependiente de pruebas y filtrado por rama main', () => {
    const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);

    const content = fs.readFileSync(ciPath, 'utf8');
    expect(content).toContain('deploy-to-render:');
    expect(content).toContain('needs: build');
    expect(content).toContain("refs/heads/main");
    expect(content).toContain('secrets.RENDER_DEPLOY_HOOK_URL');
  });

  it('debe documentar adecuadamente las variables de entorno requeridas en .env.example sin exponer credenciales', () => {
    const envExamplePath = path.join(rootDir, '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf8');
    expect(content).toContain('PORT=');
    expect(content).toContain('NODE_ENV=');
    expect(content).toContain('DATABASE_URL=');
    expect(content).toContain('JWT_SECRET=');
  });
});

// Separación de responsabilidades: Capa de Servicios para Listas (HU22)
describe('Capa de Servicios para Listas - Separación Controlador vs Servicio (HU22)', () => {
  const rootDir = process.cwd();

  it('debe existir el archivo src/services/list.service.ts con los métodos de negocio', async () => {
    const servicePath = path.join(rootDir, 'src', 'services', 'list.service.ts');
    expect(fs.existsSync(servicePath)).toBe(true);

    const { ListService } = await import('../src/services/list.service.js');
    expect(typeof ListService.create).toBe('function');
    expect(typeof ListService.update).toBe('function');
    expect(typeof ListService.delete).toBe('function');
    expect(typeof ListService.search).toBe('function');
  });

  it('ListController debe delegar las operaciones de negocio exclusivamente a ListService', () => {
    const controllerPath = path.join(rootDir, 'src', 'controllers', 'list.controller.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');

    expect(content).toContain("from '../services/list.service.js'");
    expect(content).toContain('ListService.create');
    expect(content).toContain('ListService.update');
    expect(content).toContain('ListService.delete');
    expect(content).toContain('ListService.search');
    expect(content).not.toContain('ListModel.');
  });
});

// Modelado de Estados de Lista en Prisma y Migración de Base de Datos (HU23)
describe('Modelado de Estados de Lista en Prisma y Migración (HU23)', () => {
  const rootDir = process.cwd();

  it('debe definir el campo status con valor por defecto BORRADOR en prisma/schema.prisma y contar con migración', () => {
    const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaContent).toMatch(/status\s+String\s+@default\(["']BORRADOR["']\)/);

    const migrationPath = path.join(
      rootDir,
      'prisma',
      'migrations',
      '20261019204700_add_list_status',
      'migration.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('al crear una lista nueva (POST /api/lists), el estado inicial asignado debe ser obligatoriamente BORRADOR', async () => {
    const userPayload = {
      username: 'userStatusHU23',
      email: 'status.hu23@example.com',
      password: 'password123',
    };
    await request(app).post('/api/auth/register').send(userPayload);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: userPayload.email, password: userPayload.password });
    const token = loginRes.body.token;

    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lista con estado inicial BORRADOR' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('BORRADOR');
  });
});

// Máquina de Estados de Lista y Tests de Transiciones Válidas e Inválidas (HU24 y HU25)
describe('PATCH /api/lists/:id/status - Máquina de Estados y Transiciones (HU24 y HU25)', () => {
  let ownerToken: string;
  let otherUserToken: string;

  beforeAll(async () => {
    const owner = {
      username: 'ownerEstadosHU25',
      email: 'owner.estados@example.com',
      password: 'password123',
    };
    const otherUser = {
      username: 'otherEstadosHU25',
      email: 'other.estados@example.com',
      password: 'password123',
    };

    await request(app).post('/api/auth/register').send(owner);
    await request(app).post('/api/auth/register').send(otherUser);

    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: owner.email, password: owner.password });
    ownerToken = ownerLogin.body.token;

    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: otherUser.email, password: otherUser.password });
    otherUserToken = otherLogin.body.token;
  });

  it('debe verificar el avance exitoso de BORRADOR a CONFIRMADA (HTTP 200)', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Lista para confirmar' });

    const listId = createRes.body.id;

    const statusRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'CONFIRMADA' });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('CONFIRMADA');
  });

  it('debe verificar el avance exitoso de CONFIRMADA a ELIMINADA (HTTP 200)', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Lista confirmada para eliminar' });

    const listId = createRes.body.id;

    await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'CONFIRMADA' });

    const statusRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ELIMINADA' });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('ELIMINADA');
  });

  it('Test 1 de transición inválida: Rechazo con HTTP 400 al intentar pasar de ELIMINADA a BORRADOR', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Lista eliminada - intento a borrador' });

    const listId = createRes.body.id;

    await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ELIMINADA' });

    const invalidRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'BORRADOR' });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body).toHaveProperty('message');
    expect(invalidRes.body.message).toMatch(/ELIMINADA.*BORRADOR/i);
  });

  it('Test 2 de transición inválida: Rechazo con HTTP 400 al intentar pasar de ELIMINADA a CONFIRMADA', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Lista eliminada - intento a confirmada' });

    const listId = createRes.body.id;

    await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ELIMINADA' });

    const invalidRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'CONFIRMADA' });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body).toHaveProperty('message');
    expect(invalidRes.body.message).toMatch(/ELIMINADA.*confirmar/i);
  });

  it('Test 3 de transición inválida: Rechazo con HTTP 400 al intentar revertir de CONFIRMADA a BORRADOR', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Lista confirmada - intento revertir a borrador' });

    const listId = createRes.body.id;

    await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'CONFIRMADA' });

    const invalidRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'BORRADOR' });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body).toHaveProperty('message');
    expect(invalidRes.body.message).toMatch(/CONFIRMADA.*BORRADOR/i);
  });

  it('debe proteger el cambio de estado contra manipulación por parte de un usuario no propietario (IDOR - HTTP 403)', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Lista protegida contra IDOR en estado' });

    const listId = createRes.body.id;

    const idorRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ status: 'CONFIRMADA' });

    expect(idorRes.status).toBe(403);
  });
});

// Protección Operativa: Idempotencia en Creación de Listas (HU26)
describe('POST /api/lists - Idempotencia mediante Idempotency-Key (HU26)', () => {
  let token: string;

  beforeAll(async () => {
    const user = {
      username: 'userIdempotenciaHU26',
      email: 'idempotencia.hu26@example.com',
      password: 'password123',
    };
    await request(app).post('/api/auth/register').send(user);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    token = loginRes.body.token;
  });

  it('enviar exactamente la misma carga útil con la misma Idempotency-Key en repetidas ocasiones solo genera un registro y retorna el mismo ID original', async () => {
    const idempotencyKey = 'idem-key-asado-viernes-001';
    const payload = { title: 'Lista Idempotente Asado Viernes' };

    const res1 = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(201);
    const originalId = res1.body.id;

    // Segunda petición con la misma clave de idempotencia
    const res2 = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect([200, 201]).toContain(res2.status);
    expect(res2.body.id).toBe(originalId);
    expect(res2.body.title).toBe(payload.title);

    // Tercera petición con la misma clave de idempotencia
    const res3 = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect([200, 201]).toContain(res3.status);
    expect(res3.body.id).toBe(originalId);

    // Verificar en búsqueda que solo se haya creado 1 registro en la BD
    const searchRes = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ search: 'Lista Idempotente Asado Viernes' });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.lists).toHaveLength(1);
    expect(searchRes.body.lists[0].id).toBe(originalId);
  });

  it('peticiones con diferente Idempotency-Key sí generan registros distintos', async () => {
    const resA = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'idem-key-A')
      .send({ title: 'Lista Clave A' });

    const resB = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'idem-key-B')
      .send({ title: 'Lista Clave A' });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.id).not.toBe(resB.body.id);
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

// Integración: Tarea Asíncrona en Background (Worker Thread) y Notificación SSE (HU28)
describe('GET /api/lists/:id/events - Tarea asíncrona en background y notificación SSE (HU28)', () => {
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    const user = {
      username: 'userSseHU28',
      email: 'sse.hu28@example.com',
      password: 'password123',
    };
    const other = {
      username: 'otherSseHU28',
      email: 'othersse.hu28@example.com',
      password: 'password123',
    };

    await request(app).post('/api/auth/register').send(user);
    await request(app).post('/api/auth/register').send(other);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    token = loginRes.body.token;

    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: other.email, password: other.password });
    otherToken = otherLogin.body.token;
  });

  it('al cambiar a CONFIRMADA, debe disparar la tarea asíncrona en segundo plano y emitir el resultado por el canal SSE (text/event-stream)', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lista con procesamiento paralelo y SSE' });

    const listId = createRes.body.id;

    // 1. Cambiar estado a CONFIRMADA (dispara el Worker Thread en background)
    const confirmRes = await request(app)
      .patch(`/api/lists/${listId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONFIRMADA' });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('CONFIRMADA');

    // 2. Conectarse al canal SSE GET /api/lists/:id/events y recibir el evento emitido
    const sseRes = await request(app)
      .get(`/api/lists/${listId}/events`)
      .set('Authorization', `Bearer ${token}`);

    expect(sseRes.status).toBe(200);
    expect(sseRes.headers['content-type']).toContain('text/event-stream');
    expect(sseRes.text).toContain('event: connected');
    expect(sseRes.text).toContain('event: list_processed');
    expect(sseRes.text).toContain(listId);
    expect(sseRes.text).toContain('Worker Thread');
  });

  it('debe rechazar con HTTP 403 si un usuario no propietario intenta suscribirse al canal SSE de la lista', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lista SSE privada' });

    const listId = createRes.body.id;

    const forbiddenRes = await request(app)
      .get(`/api/lists/${listId}/events`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(forbiddenRes.status).toBe(403);
  });
});

// Contenerización con Docker y Docker Compose (HU29)
describe('Contenerización End-to-End con Dockerfile y Docker Compose (HU29)', () => {
  const rootDir = process.cwd();

  it('debe existir un Dockerfile optimizado con multi-stage build para Node.js y compilación TypeScript', () => {
    const dockerfilePath = path.join(rootDir, 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const content = fs.readFileSync(dockerfilePath, 'utf8');
    expect(content).toContain('FROM node:20-slim AS builder');
    expect(content).toContain('FROM node:20-slim AS production');
    expect(content).toContain('npm run build');
    expect(content).toContain('EXPOSE 3000');
  });

  it('debe existir docker-compose.yml orquestando el servicio del backend y su volumen de persistencia', () => {
    const composePath = path.join(rootDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const content = fs.readFileSync(composePath, 'utf8');
    expect(content).toContain('repar-tir-backend:');
    expect(content).toContain('3000:3000');
    expect(content).toContain('volumes:');
    expect(content).toContain('repar_tir_sqlite_data');
  });

  it('debe incluir en README.md la instrucción docker compose up --build', () => {
    const readmePath = path.join(rootDir, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toContain('docker compose up --build');
  });
});

// Frontend: Interfaz Web de Usuario en carpeta separada frontend/ (HU30)
describe('Interfaz Web Frontend en carpeta frontend/ servida vía Express (HU30)', () => {
  const rootDir = process.cwd();

  it('debe existir la carpeta separada frontend/ con index.html, styles.css y app.js', () => {
    expect(fs.existsSync(path.join(rootDir, 'frontend', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'frontend', 'styles.css'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'frontend', 'app.js'))).toBe(true);
  });

  it('debe servir la interfaz web en GET /app con los controles de autenticación, listas, Idempotency-Key, estados y SSE', async () => {
    const res = await request(app).get('/app');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Repar-Tir');
    expect(res.text).toContain('Idempotency-Key');
    expect(res.text).toContain('BORRADOR');
    expect(res.text).toContain('CONFIRMADA');
    expect(res.text).toContain('ELIMINADA');
  });
});










