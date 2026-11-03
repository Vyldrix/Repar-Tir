import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';

registerStandardTestHooks();

// Gestión de Ítems, Cantidad de Personas y Cálculo de Gastos (HU32 y HU33)
describe('Gestión de Ítems, Cantidad de Personas y Cálculo de Gastos (HU32 y HU33)', () => {
  let tokenUserA: string;
  let tokenUserB: string;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      username: 'usuarioGastosA',
      email: 'gastos.a@example.com',
      password: 'passwordSeguro123',
    });
    const loginA = await request(app).post('/api/auth/login').send({
      email: 'gastos.a@example.com',
      password: 'passwordSeguro123',
    });
    tokenUserA = loginA.body.token;

    await request(app).post('/api/auth/register').send({
      username: 'usuarioGastosB',
      email: 'gastos.b@example.com',
      password: 'passwordSeguro123',
    });
    const loginB = await request(app).post('/api/auth/login').send({
      email: 'gastos.b@example.com',
      password: 'passwordSeguro123',
    });
    tokenUserB = loginB.body.token;
  });

  it('debe crear una lista con cantidad de personas y calcular totalAmount y amountPerPerson correctamente', async () => {
    const res = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Asado con 4 amigos',
        participantsCount: 4,
        items: [
          { name: 'Carne', price: 15000, quantity: 1 },
          { name: 'Bebidas', price: 2500, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.participantsCount).toBe(4);
    expect(res.body.items).toHaveLength(2);
    // 15000 + (2500 * 2) = 20000; 20000 / 4 = 5000
    expect(res.body.totalAmount).toBe(20000);
    expect(res.body.amountPerPerson).toBe(5000);
  });

  it('debe permitir cantidades decimales y unidades variables (kilos, gramos, litros, ej. 1.5 kg)', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Asado con unidades variables',
        participantsCount: 3,
      });

    const listId = createRes.body.id;

    // 1.5 kg de Costilla a $15000/kg -> $22500
    const resKg = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        name: 'Costilla',
        price: 15000,
        quantity: 1.5,
        unit: 'kg',
      });

    expect(resKg.status).toBe(201);
    expect(resKg.body.items[0].quantity).toBe(1.5);
    expect(resKg.body.items[0].unit).toBe('kg');
    expect(resKg.body.items[0].subtotal).toBe(22500);

    // 500 g de Queso a $9000/kg -> $4500
    const resGramos = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        name: 'Queso',
        price: 9000,
        quantity: 500,
        unit: 'g',
      });

    expect(resGramos.status).toBe(201);
    // 22500 + 4500 = 27000; 27000 / 3 = 9000
    expect(resGramos.body.totalAmount).toBe(27000);
    expect(resGramos.body.amountPerPerson).toBe(9000);
  });

  it('debe rechazar la creación si participantsCount es menor a 1 o no es un entero', async () => {
    const resNegative = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Lista inválida',
        participantsCount: 0,
      });

    expect(resNegative.status).toBe(400);

    const resFloat = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Lista inválida decimal',
        participantsCount: 3.5,
      });

    expect(resFloat.status).toBe(400);
  });

  it('debe permitir agregar un ítem dinámicamente con POST /api/lists/:id/items y recalcular los totales', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Lista dinámica para agregar ítems',
        participantsCount: 2,
      });

    const listId = createRes.body.id;
    expect(createRes.body.totalAmount).toBe(0);

    const addItemRes = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        name: 'Carbón vegetal',
        price: 3000,
        quantity: 2,
      });

    expect(addItemRes.status).toBe(201);
    expect(addItemRes.body.items).toHaveLength(1);
    expect(addItemRes.body.items[0].subtotal).toBe(6000);
    expect(addItemRes.body.totalAmount).toBe(6000);
    expect(addItemRes.body.amountPerPerson).toBe(3000);
  });

  it('debe permitir actualizar un ítem con PUT /api/lists/:id/items/:itemId y recalcular el total', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Lista para editar ítem',
        participantsCount: 2,
        items: [{ name: 'Pan de campo', price: 1000, quantity: 1 }],
      });

    const listId = createRes.body.id;
    const itemId = createRes.body.items[0].id;

    const updateItemRes = await request(app)
      .put(`/api/lists/${listId}/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        price: 1500,
        quantity: 4,
      });

    expect(updateItemRes.status).toBe(200);
    // 1500 * 4 = 6000; 6000 / 2 = 3000
    expect(updateItemRes.body.totalAmount).toBe(6000);
    expect(updateItemRes.body.amountPerPerson).toBe(3000);
  });

  it('debe permitir eliminar un ítem con DELETE /api/lists/:id/items/:itemId y recalcular', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Lista para borrar ítem',
        participantsCount: 2,
        items: [
          { name: 'Helado', price: 5000, quantity: 1 },
          { name: 'Servilletas', price: 1000, quantity: 1 },
        ],
      });

    const listId = createRes.body.id;
    const itemIdToDelete = createRes.body.items[1].id;

    const deleteItemRes = await request(app)
      .delete(`/api/lists/${listId}/items/${itemIdToDelete}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(deleteItemRes.status).toBe(200);
    expect(deleteItemRes.body.items).toHaveLength(1);
    expect(deleteItemRes.body.totalAmount).toBe(5000);
    expect(deleteItemRes.body.amountPerPerson).toBe(2500);
  });

  it('debe proteger contra IDOR al intentar agregar o modificar ítems de una lista ajena (HTTP 403)', async () => {
    const createRes = await request(app)
      .post('/api/lists')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        title: 'Lista protegida de usuario A',
        participantsCount: 3,
        items: [{ name: 'Secreto A', price: 1000, quantity: 1 }],
      });

    const listId = createRes.body.id;
    const itemId = createRes.body.items[0].id;

    const idorAddRes = await request(app)
      .post(`/api/lists/${listId}/items`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ name: 'Inyección ajena', price: 9999, quantity: 1 });

    expect(idorAddRes.status).toBe(403);

    const idorUpdateRes = await request(app)
      .put(`/api/lists/${listId}/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .send({ price: 1 });

    expect(idorUpdateRes.status).toBe(403);

    const idorDeleteRes = await request(app)
      .delete(`/api/lists/${listId}/items/${itemId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    expect(idorDeleteRes.status).toBe(403);
  });
});
