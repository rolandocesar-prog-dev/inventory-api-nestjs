import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { seedUsersAndLogin, type Tokens } from './utils/auth.js';
import { resetDatabase } from './utils/database.js';

describe('Listado de productos (e2e)', () => {
  let t: TestApp;
  let tokens: Tokens;
  let tools: string;
  let paints: string;
  const http = () => request(t.app.getHttpServer());
  const list = (query: Record<string, string | number | boolean> = {}) =>
    http()
      .get('/api/v1/products')
      .query(query)
      .auth(tokens.operator, { type: 'bearer' });
  const skus = (body: { data: { sku: string }[] }) =>
    body.data.map((p) => p.sku);

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    tokens = await seedUsersAndLogin(t);

    const category = async (name: string) =>
      (
        await http()
          .post('/api/v1/categories')
          .auth(tokens.admin, { type: 'bearer' })
          .send({ name })
          .expect(201)
      ).body.id as string;
    tools = await category('Herramientas');
    paints = await category('Pinturas');

    const products = [
      { sku: 'MART-001', name: 'Martillo', categoryId: tools },
      { sku: 'DEST-001', name: 'Destornillador plano', categoryId: tools },
      { sku: 'DEST-002', name: 'Destornillador estrella', categoryId: tools },
      { sku: 'PINT-001', name: 'Pintura látex blanca', categoryId: paints },
      { sku: 'PINT-002', name: 'Pintura esmalte roja', categoryId: paints },
    ];
    for (const p of products) {
      await http()
        .post('/api/v1/products')
        .auth(tokens.admin, { type: 'bearer' })
        .send({ ...p, price: 10 })
        .expect(201);
    }
    const old = await t.prisma.product.findUniqueOrThrow({
      where: { sku: 'PINT-002' },
    });
    await http()
      .delete(`/api/v1/products/${old.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .expect(204);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('lista los activos ordenados por nombre con los datos de la página', async () => {
    const res = await list().expect(200);

    expect(skus(res.body)).toEqual([
      'DEST-002',
      'DEST-001',
      'MART-001',
      'PINT-001',
    ]);
    expect(res.body.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 4,
      totalPages: 1,
    });
  });

  it('pagina', async () => {
    const page2 = await list({ page: 2, pageSize: 3 }).expect(200);

    expect(skus(page2.body)).toEqual(['PINT-001']);
    expect(page2.body.meta).toMatchObject({ total: 4, totalPages: 2 });
  });

  it('busca por nombre o SKU sin distinguir mayúsculas', async () => {
    expect(skus((await list({ search: 'DESTORN' }).expect(200)).body)).toEqual([
      'DEST-002',
      'DEST-001',
    ]);
    expect(skus((await list({ search: 'mart-0' }).expect(200)).body)).toEqual([
      'MART-001',
    ]);
  });

  it('filtra por categoría e incluye los inactivos solo si se piden', async () => {
    expect(skus((await list({ categoryId: paints }).expect(200)).body)).toEqual(
      ['PINT-001'],
    );
    expect(
      skus(
        (await list({ categoryId: paints, includeInactive: true }).expect(200))
          .body,
      ),
    ).toEqual(['PINT-002', 'PINT-001']);
  });

  it.each([
    ['pageSize mayor a 100', { pageSize: 101 }],
    ['page 0', { page: 0 }],
    ['categoryId inválido', { categoryId: 'x' }],
    ['includeInactive no booleano', { includeInactive: 'quizas' }],
  ])('responde 400 con %s', async (_caso, query) => {
    await list(query).expect(400);
  });

  it('exige token', async () => {
    await http().get('/api/v1/products').expect(401);
  });
});
