import { Prisma } from '../generated/prisma/client.js';

/** Violación de una restricción única (código P2002 de Prisma). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** El registro buscado para actualizar o borrar no existe (código P2025). */
export function isNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
