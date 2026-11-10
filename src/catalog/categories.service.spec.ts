import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService, categoryNameKey } from './categories.service.js';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: 'test',
  });

describe('CategoriesService', () => {
  const category = { findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
  const service = new CategoriesService({
    category,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula la clave sin mayúsculas ni espacios de más', () => {
    expect(categoryNameKey('  Material   Eléctrico ')).toBe(
      'material eléctrico',
    );
  });

  it('lista ordenado por nombre', async () => {
    await service.findAll();

    expect(category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { nameKey: 'asc' } }),
    );
  });

  it('crea con el nombre limpio y su clave', async () => {
    await service.create('  Material   Eléctrico ');

    expect(category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Material Eléctrico', nameKey: 'material eléctrico' },
      }),
    );
  });

  it('traduce los errores de la base a 409 y 404 y propaga el resto', async () => {
    category.create.mockRejectedValueOnce(prismaError('P2002'));
    await expect(service.create('Pinturas')).rejects.toBeInstanceOf(
      ConflictException,
    );

    category.update.mockRejectedValueOnce(prismaError('P2025'));
    await expect(service.rename('id', 'Pinturas')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    category.update.mockRejectedValueOnce(new Error('otra'));
    await expect(service.rename('id', 'Pinturas')).rejects.toThrow('otra');
  });

  it('renombra con el nombre limpio y su clave', async () => {
    category.update.mockResolvedValue({ id: 'id', name: 'Pinturas' });

    await expect(service.rename('id', ' Pinturas ')).resolves.toEqual({
      id: 'id',
      name: 'Pinturas',
    });
    expect(category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'id' },
        data: { name: 'Pinturas', nameKey: 'pinturas' },
      }),
    );
  });
});
