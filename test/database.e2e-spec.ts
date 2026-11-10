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
});
