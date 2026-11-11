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
  quantity   Int          // con signo: IN > 0, OUT < 0, ADJUSTMENT ≠ 0
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

### Catálogo (RF-02)

| Método y ruta           | Rol   | Notas                                                                  |
| ----------------------- | ----- | ---------------------------------------------------------------------- |
| `GET /categories`       | todos | Ordenadas por nombre.                                                  |
| `POST /categories`      | admin | 409 si el nombre existe (sin distinguir mayúsculas).                   |
| `PATCH /categories/:id` | admin | Renombrar.                                                             |
| `GET /products`         | todos | `page`, `pageSize` (≤ 100), `search`, `categoryId`, `includeInactive`. |
| `GET /products/:id`     | todos | 404 si no existe.                                                      |
| `POST /products`        | admin | Stock inicial 0. 409 por SKU, 422 si la categoría no existe.           |
| `PATCH /products/:id`   | admin | Sin `stock`: el `ValidationPipe` rechaza el campo (400).               |
| `DELETE /products/:id`  | admin | Desactiva (`active = false`) y responde 204.                           |

- **Listado paginado**: `{ data: [...], meta: { page, pageSize, total, totalPages } }`, con
  `findMany` y `count` en una misma transacción para que el total sea coherente.
- **Búsqueda**: `contains` sin distinguir mayúsculas sobre nombre y SKU.
- **SKU**: se guarda en mayúsculas y sin espacios; formato `^[A-Z0-9-]{3,32}$`.
- **Precio**: entra como número con hasta 2 decimales (≥ 0) y sale como texto con 2 decimales
  (`"45.50"`), para no perder precisión con `Decimal`.
- **Categoría con nombre único sin distinguir mayúsculas**: columna `name_key` (nombre en
  minúsculas y sin espacios de más) con índice único; el servicio la calcula al crear o renombrar.

### Movimientos de stock (RF-03)

| Método y ruta                 | Rol   | Cuerpo / consulta                                   |
| ----------------------------- | ----- | --------------------------------------------------- |
| `POST /stock/in`              | todos | `productId`, `quantity` (> 0), `reason?`            |
| `POST /stock/out`             | todos | `productId`, `quantity` (> 0), `reason?`            |
| `POST /stock/adjustments`     | admin | `productId`, `countedStock` (≥ 0), `reason`         |
| `GET /products/:id/movements` | todos | Kardex: `from`, `to` (ISO 8601), `page`, `pageSize` |

- **Cantidad con signo**: `quantity` guarda el cambio real (entrada +, salida −, ajuste ±), así
  la suma de los movimientos es el stock y el kardex se lee directo. La migración cambia el
  `CHECK (quantity > 0)` por uno que exige el signo correcto según el tipo.
- **Entrada**: `UPDATE products SET stock = stock + $q WHERE id = $id AND active RETURNING stock`.
- **Salida**: la sentencia condicional de arriba (también exige `active`).
- **Ajuste**: `SELECT … FOR UPDATE` bloquea la fila, se calcula la diferencia con el stock contado
  y se actualiza; si la diferencia es 0, 422.
- Si la sentencia no afecta filas, se consulta el producto para responder 404 (no existe),
  422 (desactivado) o 422 (stock insuficiente). El movimiento se inserta en la misma
  transacción, con `stockAfter` tomado del `RETURNING`.
- **Kardex**: ordenado por fecha ascendente (y por id para desempatar), con `from` y `to`
  inclusivos y paginado como el catálogo. Cada movimiento incluye el correo de quien lo hizo.

### Reportes (RF-04)

- **Stock bajo**: `stock <= minStock` comparando columnas con `prisma.product.fields.minStock`;
  orden por faltante (`minStock - stock`) descendente y después por nombre. Devuelve también
  `missing` (unidades que faltan para llegar al mínimo).
- **Valorización**: una consulta SQL con `SUM(price * stock)` agrupada por categoría (en
  `numeric`, sin pasar por números de punto flotante); los importes salen como texto con 2
  decimales, igual que el precio.

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

- Un filtro global (`ProblemDetailsFilter`) convierte toda excepción en este formato con
  `Content-Type: application/problem+json`. `title` es el nombre del estado en español,
  `detail` el mensaje de la excepción y, en los errores de validación (400), `errors` trae la
  lista de mensajes del `ValidationPipe`. Cada respuesta incluye `requestId`.
- Un error no previsto responde 500 con un `detail` genérico (nunca la traza ni el mensaje
  interno) y se registra completo en el log.
- `/health` conserva el formato de terminus (`status`, `info`, `error`), que es el que leen
  Docker y los monitores.

## 4.1 Logs (RNF-06)

- `nestjs-pino`: una línea JSON por petición con método, ruta, estado, duración y `requestId`.
- `X-Request-ID`: se acepta el de la petición si es un id razonable (≤ 64 caracteres
  `[A-Za-z0-9-_]`) o se genera un UUID; se devuelve siempre en la respuesta.
- Se ocultan `authorization`, `cookie` y cualquier campo `password`, `refreshToken` o
  `accessToken`; el cuerpo de las peticiones no se registra.
- `LOG_LEVEL` (por defecto `info`; las pruebas usan `silent`).

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

## 7. Despliegue público (RNF-07, RNF-08)

| Pieza          | Servicio                | Plan gratuito (verificado el 2026-11-10)                    |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| API (Docker)   | Render, servicio web    | 750 h/mes, sin tarjeta; se duerme tras 15 min sin tráfico.  |
| PostgreSQL 16+ | Neon                    | 1 GB, no vence, sin tarjeta; se suspende tras 5 min.        |
| Migraciones    | GitHub Actions (manual) | Workflow `Migrar producción` con el secreto `DATABASE_URL`. |

- No se usa la base gratuita de Render porque **vence a los 30 días**.
- **`render.yaml`** (Blueprint): servicio `web`, `runtime: docker`, `plan: free`, región
  `ohio` (cerca de Neon `aws-us-east-2`), `healthCheckPath: /health`; `JWT_SECRET` lo genera
  Render; `DATABASE_URL` se carga a mano (`sync: false`) y nunca va al repositorio.
- **Migraciones y semilla**: Render gratis no tiene comando previo al despliegue, así que el
  workflow manual corre `prisma migrate deploy` y la semilla del admin contra Neon con los
  secretos `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` del repositorio.
- **`TRUST_PROXY`** (por defecto `false`): con `true`, Express confía en el primer proxy
  (`trust proxy = 1`) y el throttler limita por la IP real del cliente, no la del balanceador.
- **Puerto**: Render define `PORT`; el _healthcheck_ de la imagen usa `${PORT:-3000}`.
- **Arranque en frío**: la primera petición tras inactividad tarda (Render ≈ 1 min y Neon
  ≈ 1 s); el README lo avisa. Sin credenciales públicas: la demo en vivo es `/docs` y `/health`.
