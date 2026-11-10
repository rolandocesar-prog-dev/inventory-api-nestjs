import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Duración del token de renovación (RF-01). */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;

export interface ParsedRefreshToken {
  id: string;
  secret: string;
}

/** Secreto aleatorio de 32 bytes en base64url (43 caracteres). */
export function generateSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Compara en tiempo constante el secreto recibido con el hash guardado. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const received = Buffer.from(hashSecret(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return received.length === stored.length && timingSafeEqual(received, stored);
}

export function formatRefreshToken({ id, secret }: ParsedRefreshToken): string {
  return `${id}.${secret}`;
}

/** Devuelve null si el token no tiene la forma `<uuid>.<secreto>`. */
export function parseRefreshToken(token: string): ParsedRefreshToken | null {
  const [id, secret, ...rest] = token.split('.');
  if (
    rest.length > 0 ||
    !id ||
    !secret ||
    !UUID.test(id) ||
    !SECRET.test(secret)
  ) {
    return null;
  }
  return { id, secret };
}
