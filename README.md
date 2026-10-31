# Inventory API — NestJS, PostgreSQL y Docker

[![CI](https://github.com/rolandocesar-prog-dev/inventory-api-nestjs/actions/workflows/ci.yml/badge.svg)](https://github.com/rolandocesar-prog-dev/inventory-api-nestjs/actions/workflows/ci.yml)

API REST de inventario para pequeños comercios: productos, categorías y movimientos de stock con
historial auditable, roles y la garantía de que **el stock nunca queda negativo**, incluso con
operaciones simultáneas.

> 🚧 Proyecto en desarrollo. El avance está en [`specs/tasks.md`](./specs/tasks.md).

## Qué demuestra

- NestJS modular con TypeScript estricto y ESM.
- PostgreSQL con transacciones y control de concurrencia.
- Autenticación JWT con roles.
- Documentación OpenAPI (Swagger) generada desde el código.
- Docker multi-etapa sin root, `docker compose` y CI con pruebas e2e.

## Stack

Node.js 22 · NestJS 12 · TypeScript · PostgreSQL 16 · Prisma · Vitest · Supertest · oxlint ·
Prettier · Docker · GitHub Actions

## Cómo ejecutarlo

Con Docker (API + base de datos):

```bash
cp .env.example .env
docker compose up --build
# http://localhost:3000/health  ·  documentación: http://localhost:3000/docs
```

En local:

```bash
npm ci
npm run start:dev
```

> Usa npm 11 o superior (`npm install -g npm@latest`) para agregar dependencias. npm 10 tiene un
> fallo conocido con este árbol de dependencias; `npm ci` funciona con ambas versiones.

## Calidad

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:e2e
```

## Cómo se desarrolla

El proyecto sigue **Spec Driven Development**:

- [`specs/requirements.md`](./specs/requirements.md): qué debe hacer, con criterios de aceptación.
- [`specs/design.md`](./specs/design.md): arquitectura, modelo de datos y decisiones.
- [`specs/tasks.md`](./specs/tasks.md): plan por hitos.

## Licencia

[MIT](./LICENSE)
