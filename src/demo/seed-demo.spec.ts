import { MovementType, Role } from '../generated/prisma/client.js';
import { DEMO_PRODUCTS, seedDemo } from './seed-demo.js';

describe('seedDemo', () => {
  const user = { findUnique: vi.fn(), upsert: vi.fn() };
  const product = { count: vi.fn(), create: vi.fn() };
  const category = { upsert: vi.fn() };
  const prisma = {
    user,
    product,
    category,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({ product, category }),
    ),
  } as unknown as Parameters<typeof seedDemo>[0];
  const hasher = { hash: vi.fn(async (p: string) => `hash(${p})`) };

  beforeEach(() => {
    vi.clearAllMocks();
    user.upsert.mockResolvedValue({ id: 'op1' });
    category.upsert.mockResolvedValue({ id: 'c1' });
  });

  it('no hace nada sin correo o contraseña y rechaza una contraseña corta', async () => {
    await expect(seedDemo(prisma, hasher, {})).resolves.toEqual({
      operator: 'skipped',
      products: 0,
    });
    await expect(
      seedDemo(prisma, hasher, { email: 'demo@x.test', password: 'corta' }),
    ).rejects.toThrow(/10 caracteres/);
    expect(user.upsert).not.toHaveBeenCalled();
  });

  it('crea siempre un operador, nunca un admin', async () => {
    user.findUnique.mockResolvedValue({ id: 'op1' });
    product.count.mockResolvedValue(3);

    const result = await seedDemo(prisma, hasher, {
      email: ' Demo@Inventario.test ',
      password: 'clave-de-demo',
    });

    expect(result).toEqual({ operator: 'updated', products: 0 });
    expect(user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'demo@inventario.test' },
        create: expect.objectContaining({ role: Role.OPERATOR }),
        update: expect.objectContaining({ role: Role.OPERATOR, active: true }),
      }),
    );
    expect(product.create).not.toHaveBeenCalled();
  });

  it('con la base vacía carga el catálogo y registra el stock inicial como entrada', async () => {
    user.findUnique.mockResolvedValue(null);
    product.count.mockResolvedValue(0);

    const result = await seedDemo(prisma, hasher, {
      email: 'demo@inventario.test',
      password: 'clave-de-demo',
    });

    expect(result).toEqual({
      operator: 'created',
      products: DEMO_PRODUCTS.length,
    });
    const first = DEMO_PRODUCTS[0]!;
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sku: first.sku,
        stock: first.stock,
        movements: {
          create: {
            userId: 'op1',
            type: MovementType.IN,
            quantity: first.stock,
            stockAfter: first.stock,
            reason: 'Stock inicial',
          },
        },
      }),
    });
  });

  it('el catálogo de ejemplo tiene SKU válidos y stock bajo para la alerta', () => {
    for (const p of DEMO_PRODUCTS) expect(p.sku).toMatch(/^[A-Z0-9-]{3,32}$/);
    expect(DEMO_PRODUCTS.some((p) => p.stock <= p.minStock)).toBe(true);
  });
});
