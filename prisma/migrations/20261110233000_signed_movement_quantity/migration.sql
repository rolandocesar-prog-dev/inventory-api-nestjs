-- La cantidad del movimiento pasa a tener signo (specs/design.md, Movimientos de stock):
-- entrada > 0, salida < 0, ajuste distinto de 0. Así la suma de movimientos es el stock.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_quantity_positive";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_sign" CHECK (
  ("type" = 'IN' AND "quantity" > 0)
  OR ("type" = 'OUT' AND "quantity" < 0)
  OR ("type" = 'ADJUSTMENT' AND "quantity" <> 0)
);
