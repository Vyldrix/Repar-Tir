import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';
import { ListService } from '../src/services/list.service.js';
import { SseService } from '../src/services/sse.service.js';
import { registerStandardTestHooks } from './helpers/test-setup.js';

registerStandardTestHooks();

// Arquitectura Modular de la Suite de Pruebas (HU39)
describe('Arquitectura Modular de la Suite de Pruebas (HU39)', () => {
  const rootDir = process.cwd();
  const testsDir = path.join(rootDir, 'tests');

  it('debe dividir la suite de pruebas en módulos independientes por dominio y responsabilidad', () => {
    const expectedFiles = [
      path.join(testsDir, 'helpers', 'test-setup.ts'),
      path.join(testsDir, 'health-and-security.test.ts'),
      path.join(testsDir, 'auth.test.ts'),
      path.join(testsDir, 'lists.test.ts'),
      path.join(testsDir, 'items.test.ts'),
      path.join(testsDir, 'trash.test.ts'),
      path.join(testsDir, 'unit.test.ts'),
    ];

    for (const filePath of expectedFiles) {
      expect(fs.existsSync(filePath)).toBe(true);
    }

    expect(fs.existsSync(path.join(testsDir, 'app.test.ts'))).toBe(false);
  });

  it('debe configurar fileParallelism: false en vitest.config.ts para ejecución determinística sobre SQLite', () => {
    const vitestConfigPath = path.join(rootDir, 'vitest.config.ts');
    const content = fs.readFileSync(vitestConfigPath, 'utf8');
    expect(content).toContain('fileParallelism: false');
  });

  it('debe validar unitariamente ListService y SseService en casos borde', async () => {
    const invalidTitle = await ListService.create('user-1', '');
    expect(invalidTitle.status).toBe(400);

    const invalidItems = await ListService.create('user-1', 'Lista Test', undefined, 2, 'no-array');
    expect(invalidItems.status).toBe(400);

    const sseTask = await SseService.triggerBackgroundConfirmation('unit-list-1', 'Cierre Paralelo');
    expect(sseTask.status).toBe('CONFIRMADA');
    expect(sseTask.listId).toBe('unit-list-1');
    expect(typeof sseTask.checksum).toBe('string');
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

    expect(allDocsCombined).toContain('200 OK');
    expect(allDocsCombined).toContain('201 Created');
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
    expect(content).not.toMatch(/JWT_SECRET:\s*["'][a-zA-Z0-9_-]{10,}["']/);
  });

  it('debe configurar el pipeline de CI/CD en GitHub Actions con el job de despliegue dependiente de pruebas y filtrado por rama main', () => {
    const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);

    const content = fs.readFileSync(ciPath, 'utf8');
    expect(content).toContain('deploy-to-render:');
    expect(content).toContain('needs: build');
    expect(content).toContain('refs/heads/main');
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

// Colección Bruno para Evaluación Docente (HU31)
describe('Colección Bruno para Evaluación Docente (HU31)', () => {
  const evalDir = path.resolve(process.cwd(), 'bruno', 'Evaluacion-Docente');

  it('debe existir el directorio bruno/Evaluacion-Docente con los 8 escenarios de prueba exigidos por la cátedra', () => {
    expect(fs.existsSync(evalDir)).toBe(true);

    const expectedFiles = [
      '1. Rechazo Fuerza Bruta (429).bru',
      '2. Rechazo Token Expirado (401).bru',
      '3. Proteccion IDOR Usuario No Propietario (403).bru',
      '4. Idempotencia Creacion Lista (Idempotency-Key).bru',
      '5. Transicion Invalida 1 - ELIMINADA a BORRADOR (400).bru',
      '6. Transicion Invalida 2 - ELIMINADA a CONFIRMADA (400).bru',
      '7. Transicion Invalida 3 - CONFIRMADA a BORRADOR (400).bru',
      '8. Cierre de Sesion y Revocacion (Logout).bru',
    ];

    for (const fileName of expectedFiles) {
      const fullPath = path.join(evalDir, fileName);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content).toContain('tests {');
      expect(content).toContain('docs {');
    }
  });
});

// Verificación de Frontend y Colección Bruno (HU36 y HU37)
describe('Frontend y Colección de Bruno para Ítems y Papelera (HU36 y HU37)', () => {
  const rootDir = process.cwd();

  it('el frontend web debe incluir controles para participantes, ítems y papelera con retención de 30 días', () => {
    const htmlPath = path.join(rootDir, 'frontend', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    expect(htmlContent).toContain('participantsCount');
    expect(htmlContent).toContain('Papelera de Reciclaje');
    expect(htmlContent).toContain('30 Días');

    const jsPath = path.join(rootDir, 'frontend', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    expect(jsContent).toContain('loadTrash');
    expect(jsContent).toContain('restoreFromTrash');
    expect(jsContent).toContain('addItemToList');
    expect(jsContent).toContain('amountPerPerson');
  });

  it('deben existir los archivos de Bruno para Items-y-Gastos y Papelera', () => {
    const itemsDir = path.join(rootDir, 'bruno', 'Items-y-Gastos');
    const trashDir = path.join(rootDir, 'bruno', 'Papelera');

    expect(fs.existsSync(path.join(itemsDir, '1. Crear Lista con Participantes e Items.bru'))).toBe(true);
    expect(fs.existsSync(path.join(itemsDir, '2. Agregar Item a Lista.bru'))).toBe(true);
    expect(fs.existsSync(path.join(itemsDir, '3. Actualizar Item de Lista.bru'))).toBe(true);
    expect(fs.existsSync(path.join(itemsDir, '4. Eliminar Item de Lista.bru'))).toBe(true);

    expect(fs.existsSync(path.join(trashDir, '1. Enviar Lista a Papelera (Soft Delete).bru'))).toBe(true);
    expect(fs.existsSync(path.join(trashDir, '2. Consultar Listas en Papelera.bru'))).toBe(true);
    expect(fs.existsSync(path.join(trashDir, '3. Restaurar Lista de Papelera.bru'))).toBe(true);
    expect(fs.existsSync(path.join(trashDir, '4. Purgar Listas Expiradas (30 Dias).bru'))).toBe(true);
    expect(fs.existsSync(path.join(trashDir, '5. Proteccion IDOR Restaurar Lista Ajena (403).bru'))).toBe(true);
  });
});
