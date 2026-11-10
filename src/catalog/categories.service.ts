import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isNotFound, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CategoryView {
  id: string;
  name: string;
}

const fields = { id: true, name: true } as const;

/** Clave para comparar nombres sin distinguir mayúsculas ni espacios de más. */
export function categoryNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<CategoryView[]> {
    return this.prisma.category.findMany({
      select: fields,
      orderBy: { nameKey: 'asc' },
    });
  }

  async create(name: string): Promise<CategoryView> {
    try {
      return await this.prisma.category.create({
        data: { name: cleanName(name), nameKey: categoryNameKey(name) },
        select: fields,
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async rename(id: string, name: string): Promise<CategoryView> {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { name: cleanName(name), nameKey: categoryNameKey(name) },
        select: fields,
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): unknown {
    if (isUniqueViolation(error)) {
      return new ConflictException('Ya existe una categoría con ese nombre');
    }
    if (isNotFound(error)) {
      return new NotFoundException('Categoría no encontrada');
    }
    return error;
  }
}
