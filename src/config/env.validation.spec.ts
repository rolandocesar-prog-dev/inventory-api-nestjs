import { NodeEnv, validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const valid = {
    NODE_ENV: 'production',
    PORT: '8080',
    DATABASE_URL: 'postgresql://inventory:secreto@db:5432/inventory',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('acepta una configuración válida y convierte los tipos', () => {
    const env = validateEnv(valid);

    expect(env.NODE_ENV).toBe(NodeEnv.Production);
    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it('usa valores por defecto para NODE_ENV y PORT', () => {
    const env = validateEnv({
      DATABASE_URL: valid.DATABASE_URL,
      JWT_SECRET: valid.JWT_SECRET,
    });

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
  });

  it('TRUST_PROXY es false por defecto y acepta "true" o "false" como texto', () => {
    expect(validateEnv(valid).TRUST_PROXY).toBe(false);
    expect(validateEnv({ ...valid, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(
      true,
    );
    expect(validateEnv({ ...valid, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(
      false,
    );
    expect(() => validateEnv({ ...valid, TRUST_PROXY: 'si' })).toThrow(
      /TRUST_PROXY/,
    );
  });

  it('falla si falta DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('lista todas las variables inválidas sin mostrar sus valores', () => {
    const run = () =>
      validateEnv({
        NODE_ENV: 'staging',
        PORT: '99999',
        DATABASE_URL: 'mysql://usuario:clave-secreta@db/inventory',
        JWT_SECRET: 'corto',
      });

    expect(run).toThrow(/NODE_ENV, PORT, DATABASE_URL, JWT_SECRET/);
    expect(run).not.toThrow(/clave-secreta/);
  });
});
