import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/** Hash de contraseñas con argon2id (RF-01). La contraseña nunca se guarda. */
@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /** Devuelve false (no lanza) si el hash no tiene un formato válido. */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
