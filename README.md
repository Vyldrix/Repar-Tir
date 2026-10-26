# Repar-Tir

![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=for-the-badge&logo=express&logoColor=white)
![Bcrypt](https://img.shields.io/badge/Bcrypt-6.0.0-4A154B?style=for-the-badge&logo=letsencrypt&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-5.0.1-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Bruno](https://img.shields.io/badge/Bruno-Collection-FF6C37?style=for-the-badge)

Solución integral y blindada desarrollada con **Node.js**, **Express 5** y **TypeScript** orientada a la **gestión, cálculo y reparto equitativo de gastos** entre múltiples personas, administración de ítems con cantidades y precios, ciclo de vida con **papelera de reciclaje (soft delete)**, autenticación JWT con refresh tokens, control de acceso basado en roles (RBAC), seguridad multicapa contra inyecciones y frontend web interactivo servido en `/app`.

---

## 📋 Resumen del Proyecto

- **¿Qué es?** Un backend desacoplado y robustecido para gestionar eventos y listas de gastos compartidos (asados, viajes, compras grupales) calculando automáticamente el costo consolidado y la división equitativa por participante.
- **¿Qué problema resuelve?** Elimina la complejidad del cálculo de gastos grupales, garantiza la retención segura de datos con papelera de reciclaje y recuperación de 30 días, y mitiga vulnerabilidades críticas de OWASP (IDOR, SQLi, NoSQLi, XSS, Prototype Pollution, Brute Force).
- **¿Para quién está pensado?** Grupos de personas que comparten gastos, aplicaciones cliente web o móviles y evaluadores que consuman servicios REST protegidos por JWT.
- **Estado actual:** 🟢 **100% Funcional y Probado** con las **38 Historias de Usuario (HU01 a HU38)** implementadas, documentadas y validadas con 78 tests automatizados.

---

## ⚡ Estado de Funcionalidades

### 🟢 IMPLEMENTADO
- **Salud del Sistema:** Endpoint `GET /api/health` para monitorización de disponibilidad.
- **Registro y Autenticación:** `POST /api/auth/register` (hash Bcrypt con 10 salt rounds) y `POST /api/auth/login` emitiendo Access Token y Refresh Token.
- **Rotación y Revocación de Tokens:** `POST /refresh` (renovación) y `POST /api/auth/logout` (revocación comprobable en memoria).
- **Gestión de Listas y Participantes (HU32 y HU33):**
  - Creación y edición de listas vinculadas al usuario autenticado con conteo de participantes (`participantsCount >= 1`).
  - Búsqueda y paginación con `POST /api/lists/search` (`page`, `limit`, filtrado por texto).
  - Consulta de lista individual por ID con `GET /api/lists/:id`.
- **Cálculo y Reparto Automático de Gastos (HU33):**
  - CRUD de ítems subordinados: `POST /api/lists/:id/items`, `PUT /api/lists/:id/items/:itemId`, `DELETE /api/lists/:id/items/:itemId`.
  - Cada ítem almacena `name`, `price`, `quantity` y `subtotal` ($price \times quantity$).
  - Cálculo consolidado en tiempo real: `totalAmount` ($\sum subtotales$) y `amountPerPerson` ($\frac{totalAmount}{participantsCount}$).
- **Papelera de Reciclaje y Restauración (HU34 y HU35):**
  - **Soft Delete:** `DELETE /api/lists/:id` envía la lista a la papelera registrando `deletedAt`. La lista deja de figurar en búsquedas activas.
  - **Consulta de Papelera:** `GET /api/lists/trash` informa listas eliminadas, fecha y días restantes de retención (30 días).
  - **Restauración:** `POST /api/lists/:id/restore` restituye la lista (`deletedAt = null`) a las listas activas.
  - **Purga Definitiva (30 días):** Tarea automática periódica y endpoint `DELETE /api/lists/trash/purge?days=30` que destruye físicamente de la base de datos registros con más de 30 días en papelera.
- **Máquina de Estados de Lista (HU23, HU24, HU25):** Flujo `BORRADOR ➔ CONFIRMADA ➔ ELIMINADA` con rechazo HTTP 400 ante transiciones prohibidas.
- **Idempotencia Operativa (HU26):** Soporte de cabecera `Idempotency-Key` en `POST /api/lists` para evitar creaciones duplicadas.
- **Procesamiento Asíncrono y SSE (HU28):** Tarea pesada en Worker Thread secundario y canal Server-Sent Events en `GET /api/lists/:id/events`.
- **Interfaz Web Frontend en `/app` (HU30 y HU36):**
  - Servida estáticamente desde la carpeta `frontend/`.
  - Formularios de autenticación, creación de listas con personas e ítems dinámicos.
  - Tarjetas con cuadro financiero en vivo y desglose de ítems.
  - Pestañas entre **Listas Activas** y **Papelera de Reciclaje** con contador regresivo y botón de restauración inmediata.
- **Seguridad Multicapa y Anti-IDOR:**
  - Mitigación IDOR en todos los endpoints de listas, ítems y papelera (HTTP 403 Forbidden).
  - Sanitización estricta (SQLi, NoSQLi, XSS, Prototype Pollution y Null Bytes).
  - Rate limiting global (100 req/min) y dedicado a login (5 intentos / 15 min).
  - Cabeceras de seguridad HSTS (`max-age=31536000`), `nosniff`, `DENY` y CORS con whitelist.
- **Contenerización Docker y Docker Compose (HU29):** Multi-stage build con volumen de datos SQLite persistente.
- **Colección Bruno (HU20, HU31, HU37):** Requests estructuradas con assertions y docs en `bruno/` para todos los módulos.
- **CI Automatizado:** GitHub Actions ejecutando linter, typechecking, tests y build sobre Node.js 20.x y 22.x.

---

## 🛠️ Tecnologías Utilizadas

- **Runtime:** Node.js (v20+ / v22+) (ES Modules)
- **Lenguaje:** TypeScript 5.9.3
- **Framework Web:** Express 5.2.1
- **Seguridad:** Bcrypt 6.0.0, crypto nativo, CORS 2.8.6
- **ORM & Base de Datos:** Prisma 6.19.3 con motor SQLite
- **Testing:** Vitest 5.0.2, Supertest 7.2.2 y @vitest/coverage-v8 (78 tests)
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
├── frontend/                  # Interfaz Web de usuario (HU30 y HU36)
│   ├── app.js                 # Lógica interactiva cliente, SSE y consumo de API
│   ├── index.html             # Estructura del panel de control y papelera
│   └── styles.css             # Estilos responsivos y cuadro de cálculo financiero
├── prisma/                    # Esquema relacional y migraciones SQLite
│   ├── migrations/            # Historial de migraciones SQL
│   └── schema.prisma          # Modelos User, List y ListItem
├── src/
│   ├── controllers/           # Controladores HTTP (auth, list)
│   ├── dtos/                  # Data Transfer Objects (auth, list, item)
│   ├── lib/                   # Instancia singleton de PrismaClient
│   ├── middlewares/           # auth, cors, rate-limit, sanitization
│   ├── models/                # user.model, list.model, list-item.model
│   ├── routes/                # auth.routes, list.routes
│   ├── services/              # list.service, sse.service
│   ├── app.ts                 # Inicialización de Express, middlewares y rutas
│   └── index.ts               # Arranque del servidor y tarea de purga automática
├── tests/                     # Suite completa de pruebas de integración (app.test.ts)
├── .env.example               # Plantilla de variables de entorno
├── docker-compose.yml         # Orquestación de contenedores y volúmenes
├── Dockerfile                 # Multi-stage build optimizado para producción
├── eslint.config.mjs          # Configuración de ESLint
├── package.json               # Dependencias, metadatos y scripts
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
   - La API quedará escuchando en `http://localhost:3000`.
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
| `PORT` | Número | Puerto de escucha del servidor | `3000` |
| `NODE_ENV` | String | Entorno (`development`, `test`, `production`) | `development` |
| `DATABASE_URL` | String | Cadena de conexión SQLite para Prisma | `"file:./dev.db"` |
| `JWT_SECRET` | String | Clave secreta para firma de Access Tokens | *Clave interna de fallback* |
| `REFRESH_TOKEN_SECRET` | String | Clave secreta para firma de Refresh Tokens | *Fallback a JWT_SECRET* |
| `REFRESH_TOKEN_EXPIRES_IN`| Número | Duración del refresh token en segundos | `604800` (7 días) |
| `BCRYPT_SALT_ROUNDS` | Número | Factor de costo de hash en Bcrypt | `10` |
| `ALLOWED_ORIGINS` | String | Lista blanca de orígenes CORS separados por coma | `http://localhost:3000,http://localhost:5173,...` |
| `LOGIN_RATE_LIMIT_MAX` | Número | Intentos permitidos de login antes del bloqueo | `5` |
| `LOGIN_RATE_LIMIT_WINDOW_MS`| Número | Ventana de tiempo para el límite de login (ms) | `900000` (15 min) |

---

## 🧪 Pruebas Automatizadas y Calidad

El proyecto cuenta con **78 pruebas de integración automatizadas** con Vitest y Supertest:

```bash
# Verificación estática de tipos
npm run typecheck

# Análisis de calidad y formato con ESLint
npm run lint

# Ejecutar pruebas automatizadas
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
