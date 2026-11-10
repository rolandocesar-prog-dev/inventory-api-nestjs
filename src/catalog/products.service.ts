import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  isForeignKeyViolation,
  isNotFound,
  isUniqueViolation,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CategoryView } from './categories.service.js';

export interface ProductInput {
  sku: string;
  name: string;
  categoryId: string;
  price: number;
  minStock?: number;
}

export type ProductChanges = Partial<ProductInput> & { active?: boolean };

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  category: CategoryView;
  price: string;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const productInclude = {
  category: { select: { id: true, name: true } },
} as const satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Precio como texto con 2 decimales: `Decimal` no pierde precisión. */
export function toProductView({
  categoryId: _categoryId,
  price,
  ...rest
}: ProductRow): ProductView {
  return { ...rest, price: price.toFixed(2) };
}

function toData(input: Partial<ProductInput>) {
  const { price, ...rest } = input;
  return price === undefined ? rest : { ...rest, price: price.toFixed(2) };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: ProductInput): Promise<ProductView> {
    try {
      const row = await this.prisma.product.create({
        data: toData(input) as Prisma.ProductUncheckedCreateInput,
        include: productInclude,
      });
      return toProductView(row);
    } catch (error) {
      throw translate(error);
    }
  }

  async findById(id: string): Promise<ProductView> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!row) throw new NotFoundException('Producto no encontrado');
    return toProductView(row);
  }

  async update(id: string, changes: ProductChanges): Promise<ProductView> {
    try {
      const row = await this.prisma.product.update({
        where: { id },
        data: toData(changes),
        include: productInclude,
      });
      return toProductView(row);
    } catch (error) {
      throw translate(error);
    }
  }

  /** Nunca se borra físicamente (RF-02): solo se desactiva. */
  async deactivate(id: string): Promise<void> {
    await this.update(id, { active: false });
  }
}

function translate(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    return new ConflictException('Ya existe un producto con ese SKU');
  }
  if (isForeignKeyViolation(error)) {
    return new UnprocessableEntityException('La categoría no existe');
  }
  if (isNotFound(error)) {
    return new NotFoundException('Producto no encontrado');
  }
  return error;
}
