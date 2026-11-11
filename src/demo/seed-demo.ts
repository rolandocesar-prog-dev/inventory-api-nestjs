import {
  MovementType,
  Role,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { categoryNameKey } from '../catalog/categories.service.js';
import type { PasswordHasher } from '../users/password-hasher.js';
import { normalizeEmail } from '../users/users.service.js';

export interface DemoInput {
  email?: string;
  password?: string;
}

export interface DemoResult {
  operator: 'skipped' | 'created' | 'updated';
  products: number;
}

interface DemoProduct {
  sku: string;
  name: string;
  category: string;
  price: string;
  minStock: number;
  stock: number;
}

/** Catálogo genérico de ferretería: sin datos de clientes reales. */
export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    sku: 'MART-001',
    name: 'Martillo de carpintero 16 oz',
    category: 'Herramientas',
    price: '45.50',
    minStock: 5,
    stock: 18,
  },
  {
    sku: 'DEST-002',
    name: 'Juego de destornilladores (6 piezas)',
    category: 'Herramientas',
    price: '62.00',
    minStock: 4,
    stock: 3,
  },
  {
    sku: 'TAL-010',
    name: 'Taladro percutor 650 W',
    category: 'Herramientas',
    price: '389.90',
    minStock: 2,
    stock: 6,
  },
  {
    sku: 'PINT-LAT-4L',
    name: 'Pintura látex blanca 4 L',
    category: 'Pinturas',
    price: '120.00',
    minStock: 10,
    stock: 7,
  },
  {
    sku: 'ROD-009',
    name: 'Rodillo de lana 9"',
    category: 'Pinturas',
    price: '28.50',
    minStock: 6,
    stock: 25,
  },
  {
    sku: 'CAB-25-100',
    name: 'Cable THW 2,5 mm² (rollo 100 m)',
    category: 'Electricidad',
    price: '310.00',
    minStock: 3,
    stock: 1,
  },
  {
    sku: 'FOCO-LED-9',
    name: 'Foco LED 9 W luz cálida',
    category: 'Electricidad',
    price: '12.50',
    minStock: 20,
    stock: 64,
  },
  {
    sku: 'TOR-8-100',
    name: 'Tornillos para madera 8 x 1" (caja 100)',
    category: 'Fijaciones',
    price: '18.00',
    minStock: 8,
    stock: 40,
  },
];

type DemoPrisma = Pick<
  PrismaClient,
  'user' | 'product' | 'category' | '$transaction'
>;

/**
 * Operador de demostración para reclutadores (specs: RF-01, M6). Crea o
 * reactiva el operador y, si no hay productos, carga el catálogo de ejemplo
 * con su entrada inicial. Sin datos, no hace nada.
 */
export async function seedDemo(
  prisma: DemoPrisma,
  hasher: Pick<PasswordHasher, 'hash'>,
  { email, password }: DemoInput,
): Promise<DemoResult> {
  if (!email || !password) return { operator: 'skipped', products: 0 };
  if (password.length < 10) {
    throw new Error('DEMO_PASSWORD debe tener al menos 10 caracteres');
  }

  const normalized = normalizeEmail(email);
  const passwordHash = await hasher.hash(password);
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  // Siempre operador: nunca se le da rol de admin a una cuenta pública.
  const operator = await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, passwordHash, role: Role.OPERATOR },
    update: { passwordHash, role: Role.OPERATOR, active: true },
    select: { id: true },
  });

  let products = 0;
  if ((await prisma.product.count()) === 0) {
    for (const item of DEMO_PRODUCTS) {
      await prisma.$transaction(async (tx) => {
        const category = await tx.category.upsert({
          where: { nameKey: categoryNameKey(item.category) },
          create: {
            name: item.category,
            nameKey: categoryNameKey(item.category),
          },
          update: {},
          select: { id: true },
        });
        await tx.product.create({
          data: {
            sku: item.sku,
            name: item.name,
            categoryId: category.id,
            price: item.price,
            minStock: item.minStock,
            stock: item.stock,
            movements: {
              create: {
                userId: operator.id,
                type: MovementType.IN,
                quantity: item.stock,
                stockAfter: item.stock,
                reason: 'Stock inicial',
              },
            },
          },
        });
      });
      products++;
    }
  }

  return { operator: existing ? 'updated' : 'created', products };
}
