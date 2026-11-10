import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService, toProductView } from './products.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: 'test',
  });

const row = {
  id: 'p1',
  sku: 'MART-001',
  name: 'Martillo',
  categoryId: 'c1',
  category: { id: 'c1', name: 'Herramientas' },
  price: new Prisma.Decimal('45.5'),
  stock: 0,
  minStock: 5,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProductsService', () => {
  const product = { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const service = new ProductsService({ product } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expone el precio con 2 decimales y la categoría sin su id suelto', () => {
    const view = toProductView(row);

    expect(view.price).toBe('45.50');
    expect(view).not.toHaveProperty('categoryId');
    expect(view.category).toEqual({ id: 'c1', name: 'Herramientas' });
  });

  it('crea con el precio como texto exacto', async () => {
    product.create.mockResolvedValue(row);

    await service.create({
      sku: 'MART-001',
      name: 'Martillo',
      categoryId: 'c1',
      price: 0.1 + 0.2,
    });

    expect(product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ price: '0.30' }),
      }),
    );
  });

  it.each([
    ['P2002', ConflictException],
    ['P2003', UnprocessableEntityException],
  ])('traduce %s al crear', async (code, type) => {
    product.create.mockRejectedValue(prismaError(code));

    await expect(
      service.create({ sku: 'A-1', name: 'x', categoryId: 'c', price: 1 }),
    ).rejects.toBeInstanceOf(type);
  });

  it('responde 404 si el producto no existe', async () => {
    product.findUnique.mockResolvedValue(null);
    await expect(service.findById('p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    product.update.mockRejectedValue(prismaError('P2025'));
    await expect(service.update('p1', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('actualiza sin tocar el precio si no viene y propaga errores desconocidos', async () => {
    product.update.mockResolvedValueOnce(row);
    await service.update('p1', { name: 'Martillo grande' });
    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Martillo grande' } }),
    );

    product.update.mockRejectedValueOnce(new Error('otra'));
    await expect(service.update('p1', { price: 2 })).rejects.toThrow('otra');
  });

  it('desactivar es una actualización de active, nunca un borrado', async () => {
    product.update.mockResolvedValue({ ...row, active: false });

    await service.deactivate('p1');

    expect(product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: { active: false } }),
    );
  });

  it('devuelve el producto encontrado', async () => {
    product.findUnique.mockResolvedValue(row);

    await expect(service.findById('p1')).resolves.toMatchObject({
      sku: 'MART-001',
      price: '45.50',
    });
  });
});
