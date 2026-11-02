import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';

registerStandardTestHooks();

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

    const titles = response.body.lists.map((l: { title: string }) => l.title);
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
    response.body.lists.forEach((item: { title: string }) => {
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
