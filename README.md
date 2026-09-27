# Repar-Tir

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![CORS](https://img.shields.io/badge/CORS-API-6A5ACD?style=for-the-badge)
![Dotenv](https://img.shields.io/badge/Dotenv-000000?style=for-the-badge&logo=dotenv&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Supertest](https://img.shields.io/badge/Supertest-Testing-FF6B35?style=for-the-badge)

Backend API para la gestión de usuarios y listas de la aplicación Repar-Tir, desarrollada con Node.js, TypeScript y Express. El proyecto está en fase inicial de construcción y cuenta con una base de arranque para levantar la API, verificar su salud y validar el comportamiento con pruebas automatizadas.

## Descripción del proyecto

Repar-Tir es un servicio backend pensado para soportar procesos de autenticación, registro de usuarios, creación y gestión de listas, así como futuras funcionalidades de seguridad y control de acceso. El repositorio actual contiene la estructura base del servidor y la configuración mínima para ejecutar la aplicación.

Actualmente el proyecto incluye:

- Servidor HTTP con Express
- Configuración en TypeScript
- Middleware CORS y parseo JSON
- Endpoint de verificación de salud del servicio
- Pruebas de integración básicas con Vitest + Supertest
- Variables de entorno con ejemplo de configuración

## Tecnologías

- Node.js
- TypeScript
- Express
- CORS
- Dotenv
- Vitest
- Supertest

## Estructura del proyecto

```text
repar-tir/
├── src/
│   ├── app.ts
│   └── index.ts
├── tests/
│   └── app.test.ts
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── LICENSE (si se agrega en el futuro)
