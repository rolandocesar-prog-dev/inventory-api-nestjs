# Tareas — API de inventario

Cada tarea referencia su requisito. Marca `[x]` al terminar y haz un commit por tarea.

## M0 · Base del proyecto

- [x] Proyecto NestJS 12 (ESM, TypeScript estricto, Vitest, oxlint, Prettier).
- [x] `GET /health`, Swagger en `/docs` y prefijo `/api/v1`, con pruebas unitarias y e2e.
- [x] Dockerfile multi-etapa sin root y `docker-compose.yml` con PostgreSQL.
- [x] CI: lint, formato, tipos, pruebas, build e imagen Docker.
- [x] Especificaciones SDD.

## M1 · Datos

- [ ] Prisma: esquema del diseño, primera migración y `CHECK (stock >= 0)`.
- [ ] `PrismaService` con cierre ordenado.
- [ ] `/health` con @nestjs/terminus verificando la base de datos (RF-05).
- [ ] PostgreSQL como servicio en el job de CI para las pruebas e2e.
- [ ] Validación global de variables de entorno al iniciar.

## M2 · Autenticación (RF-01)

- [ ] Usuarios con contraseña en hash (argon2).
- [ ] Login, token de acceso y de renovación.
- [ ] Guards de JWT y de roles; pruebas e2e de 401 y 403.
- [ ] Límite de peticiones en el login (RNF-02).
- [ ] Script de semilla con un usuario admin.

## M3 · Catálogo (RF-02)

- [ ] CRUD de categorías y productos con DTOs validados.
- [ ] Paginación, búsqueda y filtros.
- [ ] SKU único (409) y desactivación en lugar de borrado.

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
