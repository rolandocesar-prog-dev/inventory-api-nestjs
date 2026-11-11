import {
  MovementType,
  Role,
  type Prisma,
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

type DemoPrisma = Pick<PrismaClient, 'user' | 'product' | '$transaction'>;
type CatalogClient = Pick<Prisma.TransactionClient, 'category' | 'product'>;

export const DEMO_RESET_CONFIRMATION = 'RESTABLECER';

function validate({ email, password }: DemoInput): {
  email: string;
  password: string;
} {
  if (!email || !password) {
    throw new Error('Define DEMO_EMAIL y DEMO_PASSWORD');
  }
  if (password.length < 10) {
    throw new Error('DEMO_PASSWORD debe tener al menos 10 caracteres');
  }
  return { email: normalizeEmail(email), password };
}

/** Crea o reactiva el operador de demo. Siempre OPERATOR: nunca admin en una cuenta pública. */
async function upsertOperator(
  client: Pick<Prisma.TransactionClient, 'user'>,
  email: string,
  passwordHash: string,
): Promise<{ id: string; existed: boolean }> {
  const existing = await client.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const operator = await client.user.upsert({
    where: { email },
    create: { email, passwordHash, role: Role.OPERATOR },
    update: { passwordHash, role: Role.OPERATOR, active: true },
    select: { id: true },
  });
  return { id: operator.id, existed: existing !== null };
}

/** Carga el catálogo de ejemplo con su entrada inicial. Debe correr en una transacción. */
export async function loadDemoCatalog(
  tx: CatalogClient,
  operatorId: string,
): Promise<number> {
  for (const item of DEMO_PRODUCTS) {
    const nameKey = categoryNameKey(item.category);
    const category = await tx.category.upsert({
      where: { nameKey },
      create: { name: item.category, nameKey },
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
            userId: operatorId,
            type: MovementType.IN,
            quantity: item.stock,
            stockAfter: item.stock,
            reason: 'Stock inicial',
          },
        },
      },
    });
  }
  return DEMO_PRODUCTS.length;
}

/**
 * Operador de demostración para reclutadores (specs: RF-01, M6). Crea o
 * reactiva el operador y, si no hay productos, carga el catálogo de ejemplo
 * con su entrada inicial. Sin datos, no hace nada.
 */
export async function seedDemo(
  prisma: DemoPrisma,
  hasher: Pick<PasswordHasher, 'hash'>,
  input: DemoInput,
): Promise<DemoResult> {
  if (!input.email || !input.password) {
    return { operator: 'skipped', products: 0 };
  }
  const { email, password } = validate(input);
  const operator = await upsertOperator(
    prisma,
    email,
    await hasher.hash(password),
  );

  let products = 0;
  if ((await prisma.product.count()) === 0) {
    products = await prisma.$transaction((tx) =>
      loadDemoCatalog(tx, operator.id),
    );
  }
  return { operator: operator.existed ? 'updated' : 'created', products };
}

export interface ResetResult {
  deleted: { movements: number; products: number; categories: number };
  products: number;
}

/**
 * Restablece la demo (specs: RF-01, M6): borra movimientos, productos y
 * categorías y vuelve a cargar el catálogo, todo en una transacción. Los
 * usuarios se conservan. Sin la confirmación exacta, no toca nada.
 */
export async function resetDemo(
  prisma: Pick<PrismaClient, '$transaction'>,
  hasher: Pick<PasswordHasher, 'hash'>,
  input: DemoInput,
  confirmation: string | undefined,
): Promise<ResetResult> {
  if (confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new Error(
      `Restablecimiento cancelado: escribe ${DEMO_RESET_CONFIRMATION} para confirmar`,
    );
  }
  const { email, password } = validate(input);
  const passwordHash = await hasher.hash(password);

  return prisma.$transaction(async (tx) => {
    const movements = await tx.stockMovement.deleteMany();
    const products = await tx.product.deleteMany();
    const categories = await tx.category.deleteMany();
    const operator = await upsertOperator(tx, email, passwordHash);
    return {
      deleted: {
        movements: movements.count,
        products: products.count,
        categories: categories.count,
      },
      products: await loadDemoCatalog(tx, operator.id),
    };
  });
}
