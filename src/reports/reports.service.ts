import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  productInclude,
  toProductView,
  type ProductView,
} from '../catalog/products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface LowStockItem extends ProductView {
  /** Unidades que faltan para llegar al stock mínimo. */
  missing: number;
}

export interface CategoryValue {
  categoryId: string;
  name: string;
  products: number;
  units: number;
  value: string;
}

export interface InventoryValue {
  totalValue: string;
  totalUnits: number;
  products: number;
  byCategory: CategoryValue[];
}

interface CategoryValueRow {
  category_id: string;
  name: string;
  products: bigint;
  units: bigint;
  value: Prisma.Decimal;
}

/** Reportes del inventario (RF-04). */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Productos activos con stock igual o menor al mínimo, los más urgentes primero. */
  async lowStock(): Promise<LowStockItem[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        active: true,
        stock: { lte: this.prisma.product.fields.minStock },
      },
      include: productInclude,
    });
    return rows
      .map((row) => ({
        ...toProductView(row),
        missing: row.minStock - row.stock,
      }))
      .sort(
        (a, b) => b.missing - a.missing || a.name.localeCompare(b.name, 'es'),
      );
  }

  /** Valor del inventario activo (precio × stock) en `numeric`, sin redondeos intermedios. */
  async inventoryValue(): Promise<InventoryValue> {
    const rows = await this.prisma.$queryRaw<CategoryValueRow[]>`
      SELECT c.id AS category_id, c.name,
             count(p.id) AS products,
             coalesce(sum(p.stock), 0) AS units,
             coalesce(sum(p.price * p.stock), 0)::numeric(14, 2) AS value
      FROM categories c
      JOIN products p ON p.category_id = c.id AND p.active
      GROUP BY c.id, c.name
      ORDER BY value DESC, c.name ASC`;

    const byCategory = rows.map((row) => ({
      categoryId: row.category_id,
      name: row.name,
      products: Number(row.products),
      units: Number(row.units),
      value: new Prisma.Decimal(row.value).toFixed(2),
    }));
    const total = rows.reduce(
      (sum, row) => sum.plus(row.value),
      new Prisma.Decimal(0),
    );
    return {
      totalValue: total.toFixed(2),
      totalUnits: byCategory.reduce((sum, c) => sum + c.units, 0),
      products: byCategory.reduce((sum, c) => sum + c.products, 0),
      byCategory,
    };
  }
}
