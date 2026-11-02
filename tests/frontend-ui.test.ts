import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';

describe('Pulido Integral de UI/UX, Fluidez Interactiva y Cero Errores en Frontend (HU40)', () => {
  const rootDir = process.cwd();
  const htmlPath = path.join(rootDir, 'frontend', 'index.html');
  const jsPath = path.join(rootDir, 'frontend', 'app.js');
  const cssPath = path.join(rootDir, 'frontend', 'styles.css');

  it('CA1: debe eliminar diálogos nativos (alert, prompt, confirm) y proveer un modal personalizado en tema oscuro', () => {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    expect(jsContent).not.toMatch(/\balert\s*\(/);
    expect(jsContent).not.toMatch(/\bprompt\s*\(/);
    expect(jsContent).not.toMatch(/\bconfirm\s*\(/);

    expect(htmlContent).toContain('id="customModal"');
    expect(jsContent).toContain('openEditListModal');
    expect(jsContent).toContain('openEditItemModal');
  });

  it('CA2: debe contar con un sistema de notificaciones visuales flotantes (Toasts) integrado con HTTP y SSE', () => {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    expect(htmlContent).toContain('id="toastContainer"');
    expect(jsContent).toContain('showToast');
    expect(cssContent).toContain('.toast-notification');
  });

  it('CA3: debe incluir estados de carga, buscador reactivo, edición de listas/ítems y cierre limpio de conexiones SSE', () => {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    expect(htmlContent).toContain('id="searchListsInput"');
    expect(htmlContent).toContain('id="activeBadgeCount"');
    expect(jsContent).toContain('closeAllSseConnections');
    expect(jsContent).toContain('setButtonLoading');
    expect(jsContent).toContain('updateItemInList');
    expect(jsContent).toContain('updateListDetails');
  });

  it('CA4: debe servir correctamente index.html, styles.css y app.js en /app con HTTP 200 y sin referencias rotas', async () => {
    const htmlRes = await request(app).get('/app');
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers['content-type']).toContain('text/html');

    const cssRes = await request(app).get('/app/styles.css');
    expect(cssRes.status).toBe(200);
    expect(cssRes.headers['content-type']).toContain('text/css');

    const jsRes = await request(app).get('/app/app.js');
    expect(jsRes.status).toBe(200);
    expect(jsRes.headers['content-type']).toMatch(/javascript/);
  });
});
