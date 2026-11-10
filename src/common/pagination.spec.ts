import { pageArgs, pageMeta } from './pagination.js';

describe('paginación', () => {
  it('calcula skip y take', () => {
    expect(pageArgs(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(pageArgs(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it('calcula el total de páginas', () => {
    expect(pageMeta(1, 20, 0).totalPages).toBe(0);
    expect(pageMeta(1, 20, 20).totalPages).toBe(1);
    expect(pageMeta(2, 20, 21)).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
  });
});
