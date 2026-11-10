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
  un token de acceso (15 min) y uno de renovación (7 días).
- SI el correo no existe, la contraseña no coincide o el usuario está desactivado, la API DEBE
  responder 401 con el mismo mensaje genérico (sin revelar cuál de las tres falló).
- CUANDO se envía un token de renovación válido a `POST /api/v1/auth/refresh`, la API DEBE
  devolver un par nuevo e invalidar el token usado (rotación).
- SI se presenta un token de renovación ya usado o revocado, la API DEBE responder 401 y revocar
  todas las sesiones de ese usuario (posible robo del token).
- CUANDO se llama a `POST /api/v1/auth/logout` con un token de renovación, la API DEBE revocarlo.
- `GET /api/v1/auth/me` DEBE devolver el usuario autenticado (sin el hash de la contraseña).
- SI el token de acceso falta, es inválido o expiró, la API DEBE responder 401.
- SI el rol del usuario no permite la operación, la API DEBE responder 403.
- Solo un admin DEBE poder crear, listar, cambiar el rol y desactivar usuarios
  (`/api/v1/users`); SI el correo ya existe, la API DEBE responder 409.
- CUANDO un admin desactiva a un usuario, la API DEBE revocar sus sesiones; SI un admin intenta
  desactivarse o quitarse el rol de admin a sí mismo, la API DEBE responder 422 (evita quedarse
  sin administradores).
- Las contraseñas DEBEN guardarse con un hash lento (argon2 o bcrypt), nunca en texto plano, y
  tener al menos 10 caracteres.

### RF-02 · Catálogo

- La API DEBE permitir crear, consultar, actualizar y desactivar productos (SKU único, nombre,
  categoría, precio, stock mínimo) y categorías.
- Solo un admin DEBE poder modificar el catálogo; un operador solo lo consulta (403 si intenta
  cambiarlo).
- CUANDO se lista el catálogo, la API DEBE permitir paginación, búsqueda por nombre o SKU y filtro
  por categoría, y devolver el total de resultados.
- SI se intenta crear un producto con un SKU existente o una categoría con un nombre existente,
  la API DEBE responder 409. El SKU no distingue mayúsculas.
- SI la categoría indicada para un producto no existe, la API DEBE responder 422.
- El stock de un producto NO DEBE cambiarse desde el catálogo: empieza en 0 y solo cambia con
  movimientos (RF-03).
- Un producto con movimientos NO DEBE eliminarse físicamente; `DELETE` solo lo desactiva, y los
  productos inactivos no aparecen en el listado salvo que se pidan.

### RF-03 · Movimientos de stock

- CUANDO se registra una entrada, salida o ajuste, la API DEBE actualizar el stock y guardar el
  movimiento (usuario, cantidad, motivo, fecha y stock resultante) en una **misma transacción**.
- Entradas y salidas las DEBEN poder registrar el admin y el operador; los ajustes (conteo
  físico, con motivo obligatorio), solo el admin.
- Un ajuste indica el stock contado; la API DEBE registrar la diferencia. SI no hay diferencia,
  DEBE responder 422.
- SI una salida dejaría el stock en negativo, la API DEBE rechazarla con 422 y no modificar nada.
- SI el producto no existe, la API DEBE responder 404; SI está desactivado, 422.
- MIENTRAS dos operadores registran salidas del mismo producto al mismo tiempo, el stock final
  DEBE ser correcto (sin condiciones de carrera).
- Los movimientos NO DEBEN editarse ni borrarse; una corrección se registra como ajuste. La suma
  de los movimientos de un producto DEBE ser igual a su stock.

### RF-04 · Alertas y reportes

- La API DEBE listar los productos activos con stock igual o menor a su stock mínimo, los más
  urgentes primero (`GET /api/v1/reports/low-stock`).
- La API DEBE devolver el kardex (historial de movimientos) de un producto entre dos fechas.
- La API DEBE devolver el valor total del inventario activo (precio × stock), con el detalle por
  categoría (`GET /api/v1/reports/inventory-value`).
- Solo un admin DEBE poder consultar los reportes.

### RF-05 · Operación

- `GET /health` DEBE responder el estado de la API y de la base de datos.
- SI la base de datos no responde, `GET /health` DEBE responder 503 indicando qué dependencia
  falla, para que Docker y la plataforma de despliegue detecten el problema.
- La documentación OpenAPI DEBE estar disponible en `/docs`.
- SI falta una variable de entorno obligatoria o tiene un valor inválido, la API NO DEBE arrancar
  y DEBE indicar qué variable está mal (sin mostrar su valor).
- CUANDO la API recibe la señal de apagado, DEBE cerrar las conexiones a la base de datos antes de
  terminar.

## 5. Requisitos no funcionales

| ID     | Requisito                                                                  |
| ------ | -------------------------------------------------------------------------- |
| RNF-01 | Validación de todas las entradas; errores con formato uniforme (RFC 9457). |
| RNF-02 | Límite de peticiones en `auth/login` (5 por minuto por IP; luego 429).     |
| RNF-03 | `docker compose up` levanta la API y la base de datos con un solo comando. |
| RNF-04 | Cobertura ≥ 80 % en servicios; pruebas e2e contra PostgreSQL real en CI.   |
| RNF-05 | Imagen Docker multi-etapa, sin usuario root y con _healthcheck_.           |
| RNF-06 | Logs estructurados con id de petición; sin datos sensibles en los logs.    |

## 6. Criterio de "terminado"

- Todos los RF con pruebas e2e.
- API desplegada públicamente con su documentación en `/docs`.
- README con diagrama, ejemplos de uso y colección de peticiones.
