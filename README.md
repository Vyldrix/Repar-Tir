# Repar-Tir

![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=for-the-badge&logo=express&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-AuthService-244c5a?style=for-the-badge&logo=google&logoColor=white)
![Bcrypt](https://img.shields.io/badge/Bcrypt-6.0.0-4A154B?style=for-the-badge&logo=letsencrypt&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-96%20Tests%20Passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Bruno](https://img.shields.io/badge/Bruno-Collection-FF6C37?style=for-the-badge)

Solución integral y blindada desarrollada con **Node.js**, **Express 5** y **TypeScript** orientada a la **gestión, cálculo y reparto equitativo de gastos** entre múltiples personas, administración de ítems con unidades variables (`u.`, `kg`, `g`, `L`, `ml`, `pack`, `doc.`) y cantidades decimales, ciclo de vida con **papelera de reciclaje (soft delete)**, vaciado inmediato y purga automática de 30 días, autenticación dual mediante JWT/Refresh Tokens y **OAuth 2.0 con Google vía microservicio gRPC**, control de acceso basado en roles (RBAC), seguridad multicapa contra inyecciones y frontend web interactivo en modo oscuro (*Tailwind CSS + Glassmorphism*) servido en `/app`.

---

## 📋 Resumen del Proyecto

- **¿Qué es?** Un backend desacoplado y robustecido para gestionar eventos y listas de gastos compartidos (asados, viajes, compras grupales) calculando automáticamente el costo consolidado y la división equitativa por participante una vez confirmada la lista.
- **¿Qué problema resuelve?** Elimina la complejidad del cálculo de gastos grupales, garantiza la retención segura de datos con papelera de reciclaje y recuperación de 30 días (con opción de vaciado anticipado), permite el uso de cantidades continuas (kilos, litros, gramos) y mitiga vulnerabilidades críticas de OWASP (IDOR, SQLi, NoSQLi, XSS, Prototype Pollution, Brute Force).
- **¿Para quién está pensado?** Grupos de personas que comparten gastos, aplicaciones cliente web o móviles y evaluadores que consuman servicios REST o gRPC protegidos por JWT.
- **Estado actual:** 🟢 **100% Funcional y Probado** con las **41 Historias de Usuario (HU01 a HU41)** implementadas, documentadas y validadas con **96 tests automatizados distribuidos en 8 suites modulares**.

---

## ⚡ Estado de Funcionalidades

### 🟢 IMPLEMENTADO
- **Salud del Sistema:** Endpoint `GET /api/health` para monitorización de disponibilidad.
- **Registro y Autenticación Tradicional:** `POST /api/auth/register` (hash Bcrypt con 10 salt rounds) y `POST /api/auth/login` emitiendo Access Token y Refresh Token.
- **Autenticación OAuth 2.0 con Google mediante gRPC (HU41):**
  - Servicio gRPC desacoplado definido en `src/proto/auth.proto` (`AuthService.LoginWithGoogle`) e implementado en `src/grpc/auth.grpc.ts` escuchando por defecto en el puerto `50051`.
  - Pasarela HTTP en API Gateway: `POST /api/auth/google` (valida el token contra Google o el mock de pruebas y delega al servicio gRPC) y `GET /api/auth/google/config`.
  - Vinculación automática de cuentas: si el correo electrónico de Google coincide con un usuario existente, vincula `googleId` sin duplicar la cuenta.
  - Integración nativa en frontend mediante Google Identity Services (`gsi/client`) con botón interactivo oscuro responsive.
- **Rotación y Revocación de Tokens:** `POST /refresh` (renovación) y `POST /api/auth/logout` (revocación comprobable en memoria).
- **Gestión de Listas y Participantes (HU32 y HU33):**
  - Creación y edición de listas vinculadas al usuario autenticado con conteo de participantes (`participantsCount >= 1`).
  - Búsqueda y paginación con `POST /api/lists/search` (`page`, `limit`, filtrado por texto).
  - Consulta de lista individual por ID con `GET /api/lists/:id`.
- **Cálculo y Reparto de Gastos con Unidades Variables (HU33 y HU40):**
  - CRUD de ítems subordinados: `POST /api/lists/:id/items`, `PUT /api/lists/:id/items/:itemId`, `DELETE /api/lists/:id/items/:itemId`.
  - Soporte de cantidades fraccionarias y decimales (`quantity > 0`, ej. `1.5` kg) y selector de unidades de medida: `u.`, `kg`, `g`, `L`, `ml`, `pack`, `doc.`.
  - Cálculo inteligente de subtotales: para gramos y mililitros aplica la equivalencia proporcional sobre el precio por kilo o litro ($subtotal = price \times \frac{quantity}{1000}$).
  - Reparto por persona condicionado al ciclo de vida: mientras la lista se encuentra en `BORRADOR` figura como pendiente; al pasar a `CONFIRMADA` (`➔ Confirmar y Repartir`), se calcula y visualiza el costo por participante ($amountPerPerson = \frac{totalAmount}{participantsCount}$).
- **Papelera de Reciclaje, Restauración y Limpieza Inmediata (HU34, HU35 y HU40):**
  - **Soft Delete directo:** Botón unificado `🗑️ Eliminar Lista` (`DELETE /api/lists/:id`) que traslada la lista a la papelera registrando `deletedAt` y estado `ELIMINADA`.
  - **Consulta de Papelera:** `GET /api/lists/trash` informa listas eliminadas, fecha de baja y días restantes de retención (30 días).
  - **Restauración:** `POST /api/lists/:id/restore` restituye la lista (`deletedAt = null`, estado `BORRADOR`) a las listas activas.
  - **Vaciado Inmediato de Papelera:** Botón `Limpiar Papelera` (`DELETE /api/lists/trash/purge?days=0`) para depurar de inmediato todas las listas de la papelera sin esperar 30 días.
  - **Eliminación Definitiva Individual:** Botón `🗑️ Eliminar Definitivamente` (`DELETE /api/lists/:id?permanent=true`) que remueve físicamente el registro de la base de datos e impide su posterior restauración.
  - **Purga Automática de 30 días:** Tarea programada periódica que depura automáticamente registros con más de 30 días en papelera.
- **Máquina de Estados de Lista (HU23, HU24, HU25):** Flujo `BORRADOR ➔ CONFIRMADA ➔ ELIMINADA` con rechazo HTTP 400 ante transiciones prohibidas.
- **Idempotencia Operativa (HU26):** Soporte de cabecera `Idempotency-Key` en `POST /api/lists` para evitar creaciones duplicadas.
- **Procesamiento Asíncrono y SSE (HU28):** Tarea pesada en Worker Thread secundario y canal Server-Sent Events en `GET /api/lists/:id/events`.
- **Interfaz Web Frontend en `/app` (HU30, HU36 y HU40):**
  - Diseño oscuro moderno (*Tailwind CSS + Glassmorphism*) servido desde `frontend/`.
  - Marcado visual exclusivo de pestañas (única pestaña activa resaltada en azul en login/registro y vistas activas/papelera).
  - Modales personalizados (`#customModal`) para edición en vivo de listas e ítems sin diálogos nativos (`alert`/`prompt`/`confirm`).
  - Sistema de notificaciones flotantes animadas (*Toasts*), buscador reactivo con *debounce*, estados de carga y gestión limpia de conexiones `EventSource` (SSE).
- **Suite de Pruebas Modularizada (HU38, HU39 y HU41):**
  - 96 pruebas automatizadas organizadas en 8 suites temáticas independientes (`health-and-security`, `auth`, `lists`, `items`, `trash`, `grpc-auth`, `unit`, `frontend-ui`) y helpers compartidos (`test-setup.ts`).
- **Seguridad Multicapa y Anti-IDOR:**
  - Mitigación IDOR en todos los endpoints de listas, ítems y papelera (HTTP 403 Forbidden).
  - Sanitización estricta (SQLi, NoSQLi, XSS, Prototype Pollution y Null Bytes).
  - Rate limiting global (100 req/min) y dedicado a login (5 intentos / 15 min).
  - Cabeceras de seguridad HSTS (`max-age=31536000`), `nosniff`, `DENY` y CORS con whitelist.
- **Contenerización Docker y Docker Compose (HU29):** Multi-stage build con volumen de datos SQLite persistente.
- **Colección Bruno (HU20, HU31, HU37):** Requests estructuradas con assertions y docs en `bruno/` para todos los módulos.
- **CI Automatizado:** GitHub Actions ejecutando linter, typechecking, tests y build sobre Node.js 20.x y 22.x.

---

## ⚙️ Persistencia, Concurrencia y Paralelismo

1. **Persistencia Relacional ACID (SQLite + Prisma ORM):**
   - Instancia Singleton de `PrismaClient` (`src/lib/prisma.ts`) sobre SQLite (`prisma/schema.prisma`).
   - Esquema con soporte para usuarios tradicionales y OAuth 2.0 (`googleId`), cantidades decimales (`quantity: Float`) y unidades (`unit: String`).
   - Escrituras anidadas transaccionales (*Nested Writes*) al crear listas con ítems, borrado en cascada (`onDelete: Cascade`) y *Soft Delete* indexado (`@@index([deletedAt])`).
2. **Concurrencia (Event Loop Asíncrono y Sincronización):**
   - Controladores, servicios y modelos 100% no bloqueantes (`async/await`) y consultas paginadas concurrentes con `Promise.all([count, findMany])`.
   - Prevención de condiciones de carrera (*Race Conditions*) en idempotencia mediante bloqueo de promesas en vuelo (`inFlightCreations: Map<string, Promise<List>>`) y restricción única compuesta `@@unique([userId, idempotencyKey])`.
   - Múltiples suscriptores simultáneos en tiempo real vía **Server-Sent Events (SSE)**.
3. **Paralelismo Real en CPU (`Worker Threads` + `libuv`):**
   - `SseService` delega el cálculo y firma criptográfica (`crypto.pbkdf2Sync`) al confirmar una lista a un hilo secundario real (`node:worker_threads`), liberando el hilo principal de Express.
   - El cifrado `bcrypt` (10 *salt rounds*) se ejecuta en paralelo en el *thread pool* nativo en C++ de Node.js.
4. **Microservicio gRPC de Alto Rendimiento:**
   - Comunicación binaria tipada mediante HTTP/2 y Protocol Buffers en `src/grpc/auth.grpc.ts` para resolver la autenticación con Google de forma aislada.

---

## 🛠️ Tecnologías Utilizadas

- **Runtime:** Node.js (v20+ / v22+) (ES Modules)
- **Lenguaje:** TypeScript 5.9.3
- **Framework Web:** Express 5.2.1
- **RPC & Protocol Buffers:** `@grpc/grpc-js` (1.14.7), `@grpc/proto-loader` (0.8.1)
- **OAuth 2.0:** `google-auth-library` (11.3.2)
- **Seguridad:** Bcrypt 6.0.0, crypto nativo, CORS 2.8.6
- **ORM & Base de Datos:** Prisma 6.19.3 con motor SQLite
- **Testing:** Vitest 5.0.2, Supertest 7.2.2, @vitest/coverage-v8 y Stryker Mutator (96 tests en 8 suites)
- **Calidad de Código:** ESLint 10.11.0 con typescript-eslint
- **Contenedores:** Dockerfile multi-stage y Docker Compose
- **Cliente API:** Colección de Bruno v1

---

## 📁 Estructura del Repositorio

```text
repar-tir/
├── .github/workflows/         # Pipeline de CI (ci.yml)
├── bruno/                     # Colección oficial de endpoints de Bruno
│   ├── Autenticacion/         # Requests de registro, login y logout
│   ├── environments/          # Entornos Local y Production
│   ├── Evaluacion-Docente/    # 8 Escenarios de evaluación de cátedra (HU31)
│   ├── Health/                # Request de health check
│   ├── Items-y-Gastos/        # Requests de creación, alta, edición y borrado de ítems (HU37)
│   ├── Listas/                # Requests CRUD, búsqueda y estados
│   ├── Papelera/              # Requests de soft delete, papelera, restore y purga (HU37)
│   └── bruno.json             # Manifiesto de la colección
├── frontend/                  # Interfaz Web de usuario (HU30, HU36 y HU40)
│   ├── app.js                 # Lógica cliente, Google GIS, modales, toasts, SSE y API
│   ├── index.html             # Estructura del panel de control, login dual, modales y papelera
│   └── styles.css             # Estilos dark mode, glassmorphism y botón Google
├── prisma/                    # Esquema relacional y migraciones SQLite
│   ├── migrations/            # Historial de migraciones SQL (init, status, items, googleId)
│   └── schema.prisma          # Modelos User, List y ListItem
├── src/
│   ├── controllers/           # Controladores HTTP (auth, list)
│   ├── dtos/                  # Data Transfer Objects (auth, list, item)
│   ├── grpc/                  # Implementación del servidor y cliente gRPC (HU41)
│   │   └── auth.grpc.ts       # AuthService con LoginWithGoogle
│   ├── lib/                   # Instancia singleton de PrismaClient
│   ├── middlewares/           # auth, cors, rate-limit, sanitization
│   ├── models/                # user.model, list.model, list-item.model
│   ├── proto/                 # Definición Protocol Buffers (HU41)
│   │   └── auth.proto         # Contrato gRPC para AuthService
│   ├── routes/                # auth.routes, list.routes
│   ├── services/              # list.service, sse.service
│   ├── app.ts                 # Inicialización de Express, middlewares y rutas
│   └── index.ts               # Arranque de servidores HTTP/gRPC y purga automática
├── tests/                     # Suite modularizada de 96 pruebas (HU38, HU39, HU40 y HU41)
│   ├── helpers/test-setup.ts  # Utilidades de limpieza de BD y autenticación
│   ├── auth.test.ts           # Pruebas de registro, login, refresh y logout
│   ├── frontend-ui.test.ts    # Pruebas de UI/UX, modales, toasts y activos en /app
│   ├── grpc-auth.test.ts      # Pruebas unitarias e integración de Google OAuth2 vía gRPC (HU41)
│   ├── health-and-security.test.ts # Salud, JWT, HSTS y Rate Limiting
│   ├── items.test.ts          # Pruebas de ítems, unidades, decimales y reparto financiero
│   ├── lists.test.ts          # Pruebas de listas, estados, idempotencia, IDOR y SSE
│   ├── trash.test.ts          # Pruebas de papelera (soft delete), vaciado inmediato, restore y purga
│   └── unit.test.ts           # Pruebas unitarias de servicios e infraestructura
├── .env.example               # Plantilla de variables de entorno
├── docker-compose.yml         # Orquestación de contenedores y volúmenes
├── Dockerfile                 # Multi-stage build optimizado para producción
├── eslint.config.mjs          # Configuración de ESLint
├── package.json               # Dependencias, metadatos y scripts
├── stryker.config.json        # Configuración de Mutation Testing
├── tsconfig.json              # Configuración de compilación TypeScript
└── vitest.config.ts           # Configuración del framework Vitest
```

---

## ⚙️ Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js (v20.x o v22.x)
- npm

### Pasos
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/Vyldrix/Repar-Tir.git
   cd Repar-Tir
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Crear el archivo de variables de entorno:
   ```bash
   cp .env.example .env
   ```

4. Generar el cliente de Prisma y ejecutar las migraciones:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. Iniciar en modo desarrollo:
   ```bash
   npm run dev
   ```
   - La API HTTP quedará escuchando en `http://localhost:3000`.
   - El microservicio gRPC quedará activo en `127.0.0.1:50051`.
   - La interfaz web estará disponible en `http://localhost:3000/app`.

---

### 🐳 Ejecución con Docker y Docker Compose (HU29)

Para levantar la solución completa en un contenedor aislado con volumen de persistencia:

```bash
docker compose up --build
```

Para ejecutarlo en segundo plano (detached):
```bash
docker compose up -d --build
```

Verificar el estado del servicio:
```bash
curl http://localhost:3000/api/health
```

---

## 🔐 Variables de Entorno

| Variable | Tipo | Descripción | Valor por Defecto |
| :--- | :--- | :--- | :--- |
| `PORT` | Número | Puerto de escucha del servidor HTTP Express | `3000` |
| `GRPC_PORT` | Número | Puerto de escucha del servidor gRPC AuthService | `50051` |
| `NODE_ENV` | String | Entorno (`development`, `test`, `production`) | `development` |
| `DATABASE_URL` | String | Cadena de conexión SQLite para Prisma | `"file:./dev.db"` |
| `JWT_SECRET` | String | Clave secreta para firma de Access Tokens | *Clave interna de fallback* |
| `REFRESH_TOKEN_SECRET` | String | Clave secreta para firma de Refresh Tokens | *Fallback a JWT_SECRET* |
| `REFRESH_TOKEN_EXPIRES_IN`| Número | Duración del refresh token en segundos | `604800` (7 días) |
| `BCRYPT_SALT_ROUNDS` | Número | Factor de costo de hash en Bcrypt | `10` |
| `ALLOWED_ORIGINS` | String | Lista blanca de orígenes CORS separados por coma | `http://localhost:3000,http://localhost:5173,...` |
| `LOGIN_RATE_LIMIT_MAX` | Número | Intentos permitidos de login antes del bloqueo | `5` |
| `LOGIN_RATE_LIMIT_WINDOW_MS`| Número | Ventana de tiempo para el límite de login (ms) | `900000` (15 min) |
| `GOOGLE_CLIENT_ID` | String | Client ID OAuth 2.0 de Google Cloud Console | Opcional en desarrollo |

---

## 🧪 Pruebas Automatizadas y Calidad

El proyecto cuenta con **96 pruebas automatizadas distribuidas en 8 suites modulares** con Vitest y Supertest:

```bash
# Verificación estática de tipos
npm run typecheck

# Análisis de calidad y formato con ESLint
npm run lint

# Ejecutar todas las suites modulares de pruebas (96 tests)
npm test

# Ejecutar pruebas con reporte de cobertura
npm run test:coverage
```

---

## 👥 Equipo de Desarrollo

- **Lautaro Loyola** ([@Vyldrix](https://github.com/Vyldrix))
- **Mayra Moyano** ([@MayraMoy](https://github.com/MayraMoy))

---

## 📄 Licencia

ISC
