import {
  formatRefreshToken,
  generateSecret,
  hashSecret,
  parseRefreshToken,
  secretMatches,
} from './refresh-token.js';

describe('refresh-token', () => {
  const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  it('genera secretos distintos de 43 caracteres base64url', () => {
    const a = generateSecret();
    const b = generateSecret();

    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('formatea y vuelve a leer el token', () => {
    const secret = generateSecret();
    const token = formatRefreshToken({ id, secret });

    expect(parseRefreshToken(token)).toEqual({ id, secret });
  });

  it.each([
    ['sin punto', 'abc'],
    ['id que no es uuid', `123.${'a'.repeat(43)}`],
    ['secreto corto', `${id}.abc`],
    ['partes de más', `${id}.${'a'.repeat(43)}.x`],
    ['vacío', ''],
  ])('rechaza un token mal formado (%s)', (_caso, token) => {
    expect(parseRefreshToken(token)).toBeNull();
  });

  it('compara el secreto con su hash sin guardarlo', () => {
    const secret = generateSecret();
    const hash = hashSecret(secret);

    expect(hash).not.toContain(secret);
    expect(secretMatches(secret, hash)).toBe(true);
    expect(secretMatches(generateSecret(), hash)).toBe(false);
    expect(secretMatches(secret, 'abcd')).toBe(false);
  });
});
