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

- [ ] Categorías: listar, crear y renombrar, con nombre único (409).
- [ ] Productos: crear, consultar, actualizar y desactivar con DTOs validados; SKU único (409).
- [ ] Paginación, búsqueda y filtros del listado de productos.

## M4 · Stock (RF-03)

- [ ] Entradas, salidas y ajustes en transacción.
- [ ] Rechazo con 422 si el stock quedaría negativo.
- [ ] Prueba de concurrencia: 20 salidas simultáneas.
- [ ] Kardex por producto y rango de fechas.

## M5 · Reportes y entrega (RF-04, RNF)

- [ ] Alertas de stock mínimo y valorización del inventario.
- [ ] Errores en formato RFC 9457 y logs estructurados.
- [ ] Despliegue público (la API y `/docs`).
- [ ] README final con diagrama y ejemplos; colección de peticiones (`.http` o Bruno).
- [ ] Agregar el proyecto, con enlaces, a la sección Proyectos del CV.
