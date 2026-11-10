# Diseño — API de inventario

Responde al **cómo** de [`requirements.md`](./requirements.md).

## 1. Arquitectura

Monolito modular de NestJS: un módulo por área, cada uno con controlador (HTTP), servicio
(reglas de negocio) y acceso a datos. Los controladores no contienen lógica.

```
src/
├── main.ts / setup-app.ts     # arranque y configuración compartida con las pruebas e2e
├── app.module.ts
├── common/                    # filtros de error, interceptores, decoradores, paginación
├── prisma/                    # PrismaService (conexión y cierre ordenado)
├── health/                    # GET /health (ya implementado)
├── auth/                      # login, refresh, guards JWT y de roles (RF-01)
├── users/
├── catalog/                   # productos y categorías (RF-02)
├── stock/                     # movimientos y kardex (RF-03)
└── reports/                   # alertas y valorización (RF-04)
```

Rutas de negocio bajo `/api/v1`; `/health` y `/docs` fuera del prefijo.

## 2. Tecnologías

| Necesidad      | Elección                         | Motivo                                                     |
| -------------- | -------------------------------- | ---------------------------------------------------------- |
| Framework      | NestJS 12 (ESM)                  | Modular, inyección de dependencias, muy usado en empresas. |
| Base de datos  | PostgreSQL 16                    | Transacciones y bloqueos fiables para el stock.            |
| Acceso a datos | Prisma 7 + `@prisma/adapter-pg`  | Esquema tipado, migraciones versionadas, driver `pg`.      |
| Salud          | @nestjs/terminus                 | Chequeos estándar con 503 cuando falla una dependencia.    |
| Validación     | class-validator + ValidationPipe | Integrado con Nest y con Swagger.                          |
| Autenticación  | @nestjs/jwt + guard propio       | Estándar del ecosistema; sin Passport (no hace falta).     |
| Contraseñas    | argon2 (argon2id)                | Hash lento recomendado por OWASP.                          |
| Límite de uso  | @nestjs/throttler                | Límite por IP en el login (RNF-02).                        |
| Pruebas        | Vitest + Supertest               | Lo que genera Nest 12; rápido y compatible con ESM.        |
| Lint / formato | oxlint + Prettier                | Lo que genera Nest 12; lint con información de tipos.      |

## 3. Modelo de datos

Prisma 7 usa el generador `prisma-client` (ESM, extensión `.js` en los imports) con salida en
`src/generated/prisma/`. Ese código **no se versiona**: se genera con `npm run prisma:generate`,
que también corre antes de `build`, del lint y de las pruebas en el CI. La conexión la abre el
adaptador `@prisma/adapter-pg` (driver `pg`); la URL de la CLI se lee en `prisma.config.ts`.
Las tablas y columnas se nombran en _snake_case_ con `@@map`/`@map`; abajo se muestra el modelo
lógico.

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(OPERATOR)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  movements    StockMovement[]
}

model Category {
  id       String    @id @default(uuid())
  name     String    @unique
  products Product[]
}

model Product {
  id         String   @id @default(uuid())
  sku        String   @unique
  name       String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  price      Decimal  @db.Decimal(12, 2)
  stock      Int      @default(0)
  minStock   Int      @default(0)
  active     Boolean  @default(true)
  movements  StockMovement[]
}

model StockMovement {
  id         String       @id @default(uuid())
  productId  String
  product    Product      @relation(fields: [productId], references: [id])
  userId     String
  user       User         @relation(fields: [userId], references: [id])
  type       MovementType
  quantity   Int          // positivo; el signo lo define el tipo
  stockAfter Int
  reason     String?
  createdAt  DateTime     @default(now())

  @@index([productId, createdAt])
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    // SHA-256 del secreto; el secreto nunca se guarda
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}

enum Role { ADMIN OPERATOR }
enum MovementType { IN OUT ADJUSTMENT }
```

### Cómo se garantiza que el stock no quede negativo (RF-03)

La salida se hace con **una sola sentencia condicional** dentro de una transacción:

```sql
UPDATE products SET stock = stock - $qty
WHERE id = $id AND stock >= $qty
RETURNING stock;
```

Si no afecta ninguna fila, se responde 422. Como la condición y la resta ocurren en la misma
sentencia, dos salidas simultáneas no pueden dejar el stock negativo. Además se agrega
`CHECK (stock >= 0)` en la migración, como última defensa.

### Autenticación (RF-01)

- **Token de acceso**: JWT HS256 firmado con `JWT_SECRET` (≥ 32 caracteres), 15 min, con
  `sub` (id del usuario) y `role`. Va en `Authorization: Bearer …`.
- **Token de renovación**: opaco, con la forma `<id>.<secreto>` (secreto de 32 bytes aleatorios
  en base64url). En la base solo se guarda el SHA-256 del secreto (`refresh_tokens`), así que una
  copia de la base no permite iniciar sesión. Dura 7 días.
- **Rotación**: `POST /auth/refresh` marca el token como revocado y emite un par nuevo en la misma
  transacción. Si llega un token ya revocado, se revocan todos los del usuario (detección de
  reutilización) y se responde 401.
- **Guards globales**: `JwtAuthGuard` exige token en todas las rutas salvo las marcadas con
  `@Public()` (`/health`, `/docs`, `auth/login`, `auth/refresh`, `auth/logout`); además comprueba
  que el usuario siga activo. `RolesGuard` lee `@Roles(Role.ADMIN)` y responde 403.
- **Fuerza bruta**: `@nestjs/throttler` con 5 intentos por minuto por IP solo en `auth/login`.
  Para comparar la contraseña aunque el correo no exista se verifica contra un hash ficticio, así
  el tiempo de respuesta no revela qué correos existen.
- **Semilla**: `npm run seed` (y el servicio `migrate` de Docker) crea o actualiza el admin con
  `ADMIN_EMAIL` y `ADMIN_PASSWORD`; si faltan, no hace nada.

## 4. Errores

Formato uniforme (RFC 9457, _problem details_):

```json
{
  "type": "about:blank",
  "title": "Stock insuficiente",
  "status": 422,
  "detail": "...",
  "instance": "/api/v1/stock/out"
}
```

## 5. Estrategia de pruebas

| Nivel     | Qué se prueba                                                     | Dónde                                |
| --------- | ----------------------------------------------------------------- | ------------------------------------ |
| Unitarias | Servicios con repositorios simulados.                             | `src/**/*.spec.ts`                   |
| e2e       | Endpoints contra PostgreSQL real (contenedor de servicio en CI).  | `test/**/*.e2e-spec.ts`              |
| Carrera   | 20 salidas concurrentes del mismo producto; stock final correcto. | `test/stock-concurrency.e2e-spec.ts` |

Las pruebas e2e usan una base aparte (`TEST_DATABASE_URL`, por defecto `inventory_test`): un
_global setup_ aplica las migraciones con `prisma migrate deploy` y cada archivo vacía las tablas
que usa. Los archivos e2e corren en serie porque comparten la base. En el CI, PostgreSQL 16 corre
como contenedor de servicio del job.

## 6. Configuración y operación

- **Variables de entorno** validadas al iniciar con `class-validator` en `ConfigModule.validate`
  (`src/config/env.validation.ts`). Si algo falla, el proceso termina con la lista de variables
  inválidas, sin imprimir sus valores: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` y
  `LOGIN_THROTTLE_LIMIT` (intentos de login por minuto e IP; 5 por defecto, las pruebas e2e lo
  suben para no chocar con él salvo en la prueba del límite).
- **`PrismaService`** extiende el cliente generado, conecta en `onModuleInit` y desconecta en
  `onModuleDestroy`; `enableShutdownHooks()` hace que SIGTERM dispare ese cierre.
- **`GET /health`** usa terminus: `PrismaHealthIndicator.pingCheck` (`SELECT 1`, 1,5 s de
  límite). Responde 200 con `{ status: "ok", info: { database: { status: "up" } } }` o 503 con el
  detalle en `error`. El _healthcheck_ de Docker llama a esta ruta.
- **Puertos locales**: el `docker-compose.yml` publica PostgreSQL en `127.0.0.1:5443` (5432,
  5433 y 5442 los usan otros proyectos del equipo) y la API en `127.0.0.1:3000`.
