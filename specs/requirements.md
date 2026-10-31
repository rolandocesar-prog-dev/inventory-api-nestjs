# Requisitos — API de inventario

> Spec Driven Development: **qué** debe hacer la API. El **cómo** está en
> [`design.md`](./design.md) y el plan en [`tasks.md`](./tasks.md).

## 1. Objetivo

Ofrecer a pequeños comercios (tiendas, ferreterías, farmacias) una API para controlar productos y
stock, con un **historial de movimientos auditable** y la garantía de que **el stock nunca queda
negativo**.

## 2. Roles

| Rol      | Puede                                                          |
| -------- | -------------------------------------------------------------- |
| admin    | Todo: usuarios, catálogo, movimientos y reportes.              |
| operador | Consultar el catálogo y registrar entradas y salidas de stock. |

## 3. Alcance

**Incluye:** autenticación JWT, catálogo de productos y categorías, movimientos de stock, alertas
de stock mínimo, reportes simples, documentación OpenAPI y despliegue con Docker.

**Fuera de alcance (v1):** facturación, varios almacenes, multiempresa, interfaz web.

## 4. Requisitos funcionales

Criterios de aceptación en formato EARS.

### RF-01 · Autenticación y roles

- CUANDO un usuario envía credenciales válidas a `POST /api/v1/auth/login`, la API DEBE devolver
  un token de acceso (15 min) y uno de renovación.
- SI el token falta, es inválido o expiró, la API DEBE responder 401.
- SI el rol del usuario no permite la operación, la API DEBE responder 403.
- Las contraseñas DEBEN guardarse con un hash lento (argon2 o bcrypt), nunca en texto plano.

### RF-02 · Catálogo

- La API DEBE permitir crear, consultar, actualizar y desactivar productos (SKU único, nombre,
  categoría, precio, stock mínimo) y categorías.
- CUANDO se lista el catálogo, la API DEBE permitir paginación, búsqueda por nombre o SKU y filtro
  por categoría.
- SI se intenta crear un producto con un SKU existente, la API DEBE responder 409.
- Un producto con movimientos NO DEBE eliminarse físicamente; solo desactivarse.

### RF-03 · Movimientos de stock

- CUANDO se registra una entrada, salida o ajuste, la API DEBE actualizar el stock y guardar el
  movimiento (usuario, cantidad, motivo, fecha) en una **misma transacción**.
- SI una salida dejaría el stock en negativo, la API DEBE rechazarla con 422 y no modificar nada.
- MIENTRAS dos operadores registran salidas del mismo producto al mismo tiempo, el stock final
  DEBE ser correcto (sin condiciones de carrera).
- Los movimientos NO DEBEN editarse ni borrarse; una corrección se registra como ajuste.

### RF-04 · Alertas y reportes

- La API DEBE listar los productos con stock igual o menor a su stock mínimo.
- La API DEBE devolver el kardex (historial de movimientos) de un producto entre dos fechas.
- La API DEBE devolver el valor total del inventario.

### RF-05 · Operación

- `GET /health` DEBE responder el estado de la API y de la base de datos.
- La documentación OpenAPI DEBE estar disponible en `/docs`.

## 5. Requisitos no funcionales

| ID     | Requisito                                                                  |
| ------ | -------------------------------------------------------------------------- |
| RNF-01 | Validación de todas las entradas; errores con formato uniforme (RFC 9457). |
| RNF-02 | Límite de peticiones en `auth/login` para frenar ataques de fuerza bruta.  |
| RNF-03 | `docker compose up` levanta la API y la base de datos con un solo comando. |
| RNF-04 | Cobertura ≥ 80 % en servicios; pruebas e2e contra PostgreSQL real en CI.   |
| RNF-05 | Imagen Docker multi-etapa, sin usuario root y con _healthcheck_.           |
| RNF-06 | Logs estructurados con id de petición; sin datos sensibles en los logs.    |

## 6. Criterio de "terminado"

- Todos los RF con pruebas e2e.
- API desplegada públicamente con su documentación en `/docs`.
- README con diagrama, ejemplos de uso y colección de peticiones.
