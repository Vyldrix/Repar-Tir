import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';

registerStandardTestHooks();

// Papelera de Reciclaje (Soft Delete), Restauración y Purga tras 30 Días (HU34 y HU35)
describe('Papelera de Reciclaje (Soft Delete), Restauración y Purga tras 30 Días (HU34 y HU35)', () => {
  let tokenUser: string;
  let tokenOther: string;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      username: 'usuarioPapelera1',
      email: 'papelera1@example.com',
      password: 'passwordSeguro123',
    });
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'papelera1@example.com',
      password: 'passwordSeguro123',
    });
    tokenUser = loginRes.body.token;

    await request(app).post('/api/auth/register').send({
      username: 'usuarioPapelera2',
      email: 'papelera2@example.com',
      password: 'passwordSeguro123',
    });
    const loginOtherRes = await request(app).post('/api/auth/login').send({
      email: 'papelera2@example.com',
      password: 'passwordSeguro123',
    });
    tokenOther = loginOtherRes.body.token;
  });

  it('al borrar una lista con DELETE /api/lists/:id debe ir a la papelera (soft delete) y desaparecer de search', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ title: 'Lista que irá a la papelera' });

    const listId = createRes.body.id;

    // Enviar a papelera
    const deleteRes = await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(deleteRes.status).toBe(200);

    // Verificar que ya no aparece en la búsqueda activa
    const searchRes = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ search: 'Lista que irá a la papelera' });

    expect(searchRes.status).toBe(200);
    const foundInActive = searchRes.body.lists.find((l: { id: string }) => l.id === listId);
    expect(foundInActive).toBeUndefined();

    // Verificar que SÍ aparece en la papelera
    const trashRes = await request(app)
      .get('/api/lists/trash')
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(trashRes.status).toBe(200);
    const foundInTrash = trashRes.body.find((l: { id: string }) => l.id === listId);
    expect(foundInTrash).toBeDefined();
    expect(foundInTrash).toHaveProperty('daysRemaining');
    expect(foundInTrash.daysRemaining).toBeLessThanOrEqual(30);
  });

  it('debe permitir restaurar una lista desde la papelera con POST /api/lists/:id/restore y volver a figurar en search', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ title: 'Lista para restaurar' });

    const listId = createRes.body.id;

    // Enviar a papelera
    await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${tokenUser}`);

    // Restaurar desde papelera
    const restoreRes = await request(app)
      .post(`/api/lists/${listId}/restore`)
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.id).toBe(listId);
    expect(restoreRes.body.deletedAt).toBeNull();
    expect(restoreRes.body.status).toBe('BORRADOR');

    // Comprobar que vuelve a estar activa
    const searchRes = await request(app)
      .post('/api/lists/search')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ search: 'Lista para restaurar' });

    expect(searchRes.status).toBe(200);
    const restoredFound = searchRes.body.lists.find((l: { id: string }) => l.id === listId);
    expect(restoredFound).toBeDefined();
  });

  it('debe permitir limpiar la papelera antes de los 30 días (days=0) e impedir restaurar listas eliminadas definitivamente', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ title: 'Lista para vaciar de la papelera' });

    const listId = createRes.body.id;

    await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${tokenUser}`);

    const emptyRes = await request(app)
      .delete('/api/lists/trash/purge?days=0')
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.purgedCount).toBeGreaterThanOrEqual(1);

    // Ya no se puede restaurar porque fue eliminada definitivamente
    const restoreAfterPurge = await request(app)
      .post(`/api/lists/${listId}/restore`)
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(restoreAfterPurge.status).toBe(404);
  });

  it('debe rechazar con HTTP 403 Forbidden si otro usuario intenta restaurar una lista ajena', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ title: 'Lista privada de User 1 en papelera' });

    const listId = createRes.body.id;

    await request(app)
      .delete(`/api/lists/${listId}`)
      .set('Authorization', `Bearer ${tokenUser}`);

    const idorRestoreRes = await request(app)
      .post(`/api/lists/${listId}/restore`)
      .set('Authorization', `Bearer ${tokenOther}`);

    expect(idorRestoreRes.status).toBe(403);
  });

  it('debe purgar definitivamente de la BD listas con más de 30 días en la papelera vía DELETE /api/lists/trash/purge', async () => {
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

    const oldList = await prisma.list.create({
      data: {
        title: 'Lista antigua expirada de hace 35 días',
        userId: (await prisma.user.findFirst({ where: { email: 'papelera1@example.com' } }))!.id,
        deletedAt: thirtyFiveDaysAgo,
      },
    });

    const purgeRes = await request(app)
      .delete('/api/lists/trash/purge?days=30')
      .set('Authorization', `Bearer ${tokenUser}`);

    expect(purgeRes.status).toBe(200);
    expect(purgeRes.body.purgedCount).toBeGreaterThanOrEqual(1);

    const physicallyDeleted = await prisma.list.findUnique({
      where: { id: oldList.id },
    });
    expect(physicallyDeleted).toBeNull();
  });
});
