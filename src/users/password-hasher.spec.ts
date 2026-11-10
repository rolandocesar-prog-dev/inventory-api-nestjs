import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('genera un hash argon2id que no contiene la contraseña', async () => {
    const hash = await hasher.hash('una-clave-larga');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('una-clave-larga');
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hasher.hash('una-clave-larga');

    await expect(hasher.verify(hash, 'una-clave-larga')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'otra-clave')).resolves.toBe(false);
  });

  it('devuelve false con un hash mal formado', async () => {
    await expect(hasher.verify('no-es-un-hash', 'x')).resolves.toBe(false);
  });
});
