# Repar-Tir Backend API

![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=for-the-badge&logo=express&logoColor=white)
![Bcrypt](https://img.shields.io/badge/Bcrypt-6.0.0-4A154B?style=for-the-badge&logo=letsencrypt&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-5.0.1-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Bruno](https://img.shields.io/badge/Bruno-Collection-FF6C37?style=for-the-badge)

API RESTful modular y blindada desarrollada con **Node.js**, **Express 5** y **TypeScript**, orientada a la gestión de cuentas de usuario, autenticación JWT con refresh tokens, control de acceso basado en roles (RBAC), seguridad perimetral contra inyecciones y administración de listas personales con aislamiento estricto de recursos.

---

## 📋 Resumen del Proyecto

- **¿Qué es?** Un backend desacoplado de alto rendimiento y seguridad multicapa para autenticación, gestión de sesiones y control de listas de recursos.
- **¿Qué problema resuelve?** Centraliza la persistencia relacional y el acceso seguro a listas privadas, mitigando vulnerabilidades críticas de OWASP (IDOR, SQLi, NoSQLi, XSS, Prototype Pollution, Brute Force).
- **¿Para quién está pensado?** Aplicaciones cliente (web SPA o móviles) y desarrolladores que consuman servicios REST protegidos por JWT.
- **Estado actual:** 🟢 **Backend completo y robustecido** con las 20 Historias de Usuario (HU01 a HU20) implementadas y probadas en el repositorio.

---

## ⚡ Estado de Funcionalidades

### 🟢 IMPLEMENTADO
- **Salud del Sistema:** Endpoint `GET /api/health` para monitorización de disponibilidad.
- **Registro de Usuarios:** `POST /api/auth/register` con validación estricta de unicidad y hash no reversible con **Bcrypt** (10 salt rounds).
- **Inicio de Sesión:** `POST /api/auth/login` por correo o nombre de usuario, emitiendo access token JWT y refresh token.
- **Rotación de Tokens:** `POST /refresh` (y `POST /api/refresh`) para renovación de credenciales sin reintroducir contraseñas.
- **Revocación:** Mecanismo en memoria para invalidar refresh tokens comprometidos.
- **Creación de Listas:** `POST /api/lists` vinculadas automáticamente al usuario autenticado.
- **Búsqueda y Paginación:** `POST /api/lists/search` con filtrado por texto (`search`) y paginación (`page`, `limit`).
- **Edición y Borrado Seguro:** `PUT /api/lists/:id` y `DELETE /api/lists/:id` con verificación de titularidad y mitigación estricta contra **IDOR** (rechazo con HTTP 403 ante listas ajenas).
- **Middleware `requireAuth`:** Validación de tokens JWT y rechazo de peticiones no autorizadas (HTTP 401).
- **Factoría `requireRole`:** Middleware configurable para autorizaciones por rol (HTTP 403).
- **Rate Limiting Multicapa:**
  - Límite global: 100 req/min por IP.
  - Límite dedicado a Login: 5 intentos cada 15 min por IP/usuario con extensión por reincidencia y registro de auditoría (`rateLimitAuditLogs`).
- **Sanitización de Entradas:** Detección de patrones SQL Injection, operadores NoSQL (`$`), escape HTML contra XSS, rechazo de Null Bytes y protección contra Prototype Pollution (`__proto__`).
- **Cabeceras HTTP y CORS:** HSTS (`max-age=31536000`), `nosniff`, `DENY` y política CORS con lista blanca de orígenes.
- **Persistencia Relacional:** Prisma ORM sobre SQLite con borrado en cascada e índices en `userId`.
- **Colección Bruno:** Especificación completa de requests en la carpeta `bruno/` para pruebas manuales y automatizadas.
- **CI Automatizado:** GitHub Actions ejecutando linter, typechecking, tests y build sobre Node.js 20.x y 22.x.

### 🔵 PLANIFICADO
- Interfaz gráfica de usuario (Frontend web/móvil) [POR DEFINIR].
- Modelado de ítems o tareas internas dentro de cada lista (`ListItem`) [POR DEFINIR].
- Soporte para base de datos cliente/servidor para producción (PostgreSQL/MySQL) [POR DEFINIR].
- Contenerización mediante Docker y Docker Compose [POR DEFINIR].

---

## 🛠️ Tecnologías Utilizadas

- **Runtime:** Node.js (v20+ / v22+) (ES Modules)
- **Lenguaje:** TypeScript 5.9.3
- **Framework Web:** Express 5.2.1
- **Seguridad:** Bcrypt 6.0.0, crypto nativo, CORS 2.8.6
- **ORM & Base de Datos:** Prisma 6.19.3 con motor SQLite
- **Testing:** Vitest 5.0.1, Supertest 7.2.2 y @vitest/coverage-v8
- **Calidad de Código:** ESLint 10.11.0 con typescript-eslint
- **Cliente API:** Colección de Bruno v1

---

## 📁 Estructura del Repositorio

```text
repar-tir/
├── .github/workflows/    # Pipeline de CI (ci.yml)
├── bruno/                # Colección oficial de endpoints de Bruno (HU20)
│   ├── Autenticacion/    # Requests de registro y login
│   ├── environments/     # Entornos Local y Production
│   ├── Health/           # Request de health check
│   ├── Listas/           # Requests CRUD y búsqueda de listas
│   └── bruno.json        # Manifiesto de la colección
├── prisma/               # Esquema relacional y migraciones SQLite
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── controllers/      # Controladores HTTP (auth, list)
│   ├── dtos/             # Data Transfer Objects
│   ├── lib/              # Instancia singleton de PrismaClient
│   ├── middlewares/      # auth, cors, rate-limit, sanitization
│   ├── models/           # user.model (bcrypt), list.model
│   ├── routes/           # auth.routes, list.routes
│   ├── app.ts            # Inicialización de middlewares y rutas
│   └── index.ts          # Arranque del servidor HTTP
├── tests/                # Pruebas automatizadas de integración (app.test.ts)
├── .env.example          # Plantilla de variables de entorno
├── eslint.config.mjs     # Configuración de ESLint
├── package.json          # Metadatos, dependencias y scripts
├── tsconfig.json         # Configuración de TypeScript
└── vitest.config.ts      # Configuración de Vitest
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
   La API quedará escuchando en `http://localhost:3000`.

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

```bash
# Verificación estática de tipos
npm run typecheck

# Análisis de calidad y formato
npm run lint

# Ejecutar pruebas automatizadas
npm test

# Ejecutar pruebas con reporte de cobertura
npm run test:coverage
```

---

## 🚀 Despliegue (Deployment)

- ⚪ **Estado:** **[POR DEFINIR]**
- Actualmente no hay proveedores de hosting configurados en el repositorio. Para ejecutar en producción:
  ```bash
  npm run build
  npm start
  ```

---

## 👥 Equipo de Desarrollo

- **Lautaro Loyola** ([@Vyldrix](https://github.com/Vyldrix))
- **Mayra Moyano** ([@MayraMoy](https://github.com/MayraMoy))

---

## 📄 Licencia

ISC
