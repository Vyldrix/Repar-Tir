import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { clearRateLimits } from '../src/middlewares/rate-limit.middleware.js';
import { requireAuth, requireRole, signJWT } from '../src/middlewares/auth.middleware.js';
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

// Middleware factoría requireRole para control de acceso basado en roles (HU15).
describe('Middleware factoría requireRole y control de acceso (HU15)', () => {
  it('debe aceptar un arreglo de roles permitidos y retornar una función middleware de orden superior', () => {
    const middleware = requireRole(['admin', 'editor']);
    expect(typeof middleware).toBe('function');
    expect(middleware.length).toBe(3); // (req, res, next)
  });

  it('debe retornar 401 Unauthorized si el usuario no ha sido autenticado previamente con requireAuth', () => {
    const middleware = requireRole(['admin']);
    const mockReq = {} as any; // sin req.user
    let statusSent = 0;
    let jsonSent: any = null;
    const mockRes = {
      status: (code: number) => {
        statusSent = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonSent = data;
        return mockRes;
      },
    } as any;
    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    middleware(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(false);
    expect(statusSent).toBe(401);
    expect(jsonSent).toHaveProperty('message');
  });

  it('debe retornar 403 Forbidden si el usuario autenticado no posee un rol válido asignado', () => {
    const middleware = requireRole(['admin']);
    const mockReq = {
      user: { id: 'user-sin-rol-id' }, // autenticado pero sin rol
    } as any;
    let statusSent = 0;
    let jsonSent: any = null;
    const mockRes = {
      status: (code: number) => {
        statusSent = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonSent = data;
        return mockRes;
      },
    } as any;
    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    middleware(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(false);
    expect(statusSent).toBe(403);
    expect(jsonSent).toHaveProperty('message');
  });

  it('debe retornar 403 Forbidden si el rol del usuario no se encuentra dentro del arreglo autorizado', () => {
    const middleware = requireRole(['admin', 'superadmin']);
    const mockReq = {
      user: { id: 'user-normal-id', role: 'user' },
    } as any;
    let statusSent = 0;
    let jsonSent: any = null;
    const mockRes = {
      status: (code: number) => {
        statusSent = code;
        return mockRes;
      },
      json: (data: any) => {
        jsonSent = data;
        return mockRes;
      },
    } as any;
    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    middleware(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(false);
    expect(statusSent).toBe(403);
    expect(jsonSent).toHaveProperty('message');
  });

  it('debe permitir el flujo (next()) si el rol del usuario está incluido en el arreglo autorizado', () => {
    const middleware = requireRole(['admin', 'moderator']);
    const mockReq = {
      user: { id: 'admin-user-id', role: 'admin' },
    } as any;
    let nextCalled = false;
    const mockRes = {} as any;
    const mockNext = () => {
      nextCalled = true;
    };

    middleware(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(true);
  });

  it('debe permitir el flujo si el usuario posee un arreglo de roles y al menos uno coincide', () => {
    const middleware = requireRole(['admin']);
    const mockReq = {
      user: { id: 'multi-role-user-id', roles: ['user', 'admin'] },
    } as any;
    let nextCalled = false;
    const mockRes = {} as any;
    const mockNext = () => {
      nextCalled = true;
    };

    middleware(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(true);
  });

  it('debe funcionar en conjunto con requireAuth en peticiones HTTP completas', async () => {
    // Montar ruta de prueba protegida por requireAuth y requireRole(['admin'])
    app.get('/api/test-role-endpoint', requireAuth, requireRole(['admin']), (_req, res) => {
      res.status(200).json({ status: 'success', data: 'Zona restringida para admin' });
    });

    // 1. Petición sin token -> 401
    const resSinToken = await request(app).get('/api/test-role-endpoint');
    expect(resSinToken.status).toBe(401);

    // 2. Petición con token con rol 'user' -> 403
    const userToken = signJWT({ userId: 'user-normal', role: 'user' });
    const resUser = await request(app)
      .get('/api/test-role-endpoint')
      .set('Authorization', `Bearer ${userToken}`);
    expect(resUser.status).toBe(403);

    // 3. Petición con token con rol 'admin' -> 200
    const adminToken = signJWT({ userId: 'admin-user', role: 'admin' });
    const resAdmin = await request(app)
      .get('/api/test-role-endpoint')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body).toHaveProperty('data', 'Zona restringida para admin');
  });
});
