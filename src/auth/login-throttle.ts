import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { EnvironmentVariables } from '../config/env.validation.js';

export const LOGIN_THROTTLE_TTL_MS = 60_000;

/** Límite del login por IP (RNF-02): `LOGIN_THROTTLE_LIMIT` intentos por minuto. */
export function loginThrottleOptions(
  config: ConfigService<EnvironmentVariables, true>,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'login',
        ttl: LOGIN_THROTTLE_TTL_MS,
        limit: config.get('LOGIN_THROTTLE_LIMIT', { infer: true }),
      },
    ],
    errorMessage: 'Demasiados intentos de inicio de sesión; espera un minuto',
  };
}
