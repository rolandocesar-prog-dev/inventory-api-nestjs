# Tareas — API de inventario

Cada tarea referencia su requisito. Marca `[x]` al terminar y haz un commit por tarea.

## M0 · Base del proyecto

- [x] Proyecto NestJS 12 (ESM, TypeScript estricto, Vitest, oxlint, Prettier).
- [x] `GET /health`, Swagger en `/docs` y prefijo `/api/v1`, con pruebas unitarias y e2e.
- [x] Dockerfile multi-etapa sin root y `docker-compose.yml` con PostgreSQL.
- [x] CI: lint, formato, tipos, pruebas, build e imagen Docker.
- [x] Especificaciones SDD.

## M1 · Datos

- [x] Prisma: esquema del diseño, primera migración y `CHECK (stock >= 0)`.
- [x] `PrismaService` con cierre ordenado.
- [x] `/health` con @nestjs/terminus verificando la base de datos (RF-05).
- [x] PostgreSQL como servicio en el job de CI para las pruebas e2e.
- [x] Validación global de variables de entorno al iniciar.

## M2 · Autenticación (RF-01)

- [x] Usuarios con contraseña en hash (argon2) y tabla `refresh_tokens`.
- [x] Login, token de acceso y de renovación, con rotación, detección de reutilización y logout.
- [x] Guards de JWT y de roles; `GET /auth/me`; pruebas e2e de 401 y 403.
- [x] Gestión de usuarios para el admin (`/users`: crear, listar, cambiar rol, desactivar).
- [x] Límite de peticiones en el login (RNF-02).
- [x] Script de semilla con un usuario admin.

## M3 · Catálogo (RF-02)

- [x] Categorías: listar, crear y renombrar, con nombre único (409).
- [x] Productos: crear, consultar, actualizar y desactivar con DTOs validados; SKU único (409).
- [x] Paginación, búsqueda y filtros del listado de productos.

## M4 · Stock (RF-03)

- [x] Cantidad con signo en los movimientos (migración de las restricciones).
- [x] Entradas, salidas y ajustes en transacción; 422 si el stock quedaría negativo.
- [x] Prueba de concurrencia: 20 salidas simultáneas.
- [x] Kardex por producto y rango de fechas.

## M5 · Reportes y entrega (RF-04, RNF)

- [x] Alertas de stock mínimo y valorización del inventario.
- [x] Errores en formato RFC 9457.
- [x] Logs estructurados con `X-Request-ID` y sin datos sensibles (RNF-06).
- [x] Preparar el despliegue: `TRUST_PROXY`, puerto del healthcheck, `render.yaml` y workflow de migraciones.
- [x] Despliegue público en Render + Neon (la API y `/docs`).
- [x] README final con diagrama y ejemplos; colección de peticiones (`.http` o Bruno).
- [x] Agregar el proyecto, con enlaces, a la sección Proyectos del CV.

## M6 · Demostración para reclutadores

- [x] Semilla del operador de demo y catálogo de ejemplo.
- [ ] Credenciales de demo en el workflow de producción y en el README; login verificado en vivo.
