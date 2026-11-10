import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resetDatabase } from './utils/database.js';

describe('Base de datos (e2e)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('las migraciones crean el esquema y se puede guardar un producto', async () => {
    const category = await prisma.category.create({
      data: { name: 'Herramientas', nameKey: 'herramientas' },
    });
    const product = await prisma.product.create({
      data: {
        sku: 'MART-001',
        name: 'Martillo',
        categoryId: category.id,
        price: '45.50',
      },
    });

    expect(product.stock).toBe(0);
    expect(product.price.toString()).toBe('45.5');
  });

  it('el CHECK de la base rechaza un stock negativo (RF-03, última defensa)', async () => {
    const category = await prisma.category.create({
      data: { name: 'Pinturas', nameKey: 'pinturas' },
    });

    await expect(
      prisma.product.create({
        data: {
          sku: 'PINT-001',
          name: 'Pintura',
          categoryId: category.id,
          price: '10',
          stock: -1,
        },
      }),
    ).rejects.toThrow(/products_stock_non_negative/);
  });

  it('el CHECK exige el signo de la cantidad según el tipo de movimiento', async () => {
    const category = await prisma.category.create({
      data: { name: 'Pinturas', nameKey: 'pinturas' },
    });
    const product = await prisma.product.create({
      data: {
        sku: 'PINT-001',
        name: 'Pintura',
        categoryId: category.id,
        price: '10',
      },
    });
    const user = await prisma.user.create({
      data: { email: 'a@b.test', passwordHash: 'x' },
    });
    const movement = (type: 'IN' | 'OUT' | 'ADJUSTMENT', quantity: number) =>
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          userId: user.id,
          type,
          quantity,
          stockAfter: 5,
        },
      });

    await expect(movement('IN', 5)).resolves.toBeDefined();
    await expect(movement('OUT', -1)).resolves.toBeDefined();
    await expect(movement('ADJUSTMENT', -2)).resolves.toBeDefined();
    for (const [type, quantity] of [
      ['IN', -1],
      ['OUT', 1],
      ['ADJUSTMENT', 0],
    ] as const) {
      await expect(movement(type, quantity)).rejects.toThrow(
        /stock_movements_quantity_sign/,
      );
    }
  });
});
