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
| Acceso a datos | Prisma                           | Esquema tipado, migraciones versionadas.                   |
| Validación     | class-validator + ValidationPipe | Integrado con Nest y con Swagger.                          |
| Autenticación  | @nestjs/jwt + passport-jwt       | Estándar del ecosistema.                                   |
| Pruebas        | Vitest + Supertest               | Lo que genera Nest 12; rápido y compatible con ESM.        |
| Lint / formato | oxlint + Prettier                | Lo que genera Nest 12; lint con información de tipos.      |

## 3. Modelo de datos

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

enum Role { ADMIN OPERATOR }
enum MovementType { IN OUT ADJUSTMENT }
```

### Cómo se garantiza que el stock no quede negativo (RF-03)

La salida se hace con **una sola sentencia condicional** dentro de una transacción:

```sql
UPDATE "Product" SET stock = stock - $qty
WHERE id = $id AND stock >= $qty
RETURNING stock;
```

Si no afecta ninguna fila, se responde 422. Como la condición y la resta ocurren en la misma
sentencia, dos salidas simultáneas no pueden dejar el stock negativo. Además se agrega
`CHECK (stock >= 0)` en la migración, como última defensa.

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
