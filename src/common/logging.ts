import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { EnvironmentVariables } from '../config/env.validation.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Usa el `X-Request-ID` recibido si es razonable; si no, genera un UUID. */
export function requestIdFor(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader('X-Request-ID', id);
  return id;
}

/** Campos que nunca deben llegar al log (RNF-06). */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.refreshToken',
  '*.accessToken',
];

/** Logs JSON de una línea por petición, con id y sin datos sensibles. */
export function loggerOptions(
  config: ConfigService<EnvironmentVariables, true>,
): Params {
  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL', { infer: true }),
      genReqId: requestIdFor,
      redact: { paths: REDACTED_PATHS, censor: '[oculto]' },
      // Sin cuerpo ni consulta: la ruta basta y evita registrar datos personales.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) =>
        error || res.statusCode >= 500
          ? 'error'
          : res.statusCode >= 400
            ? 'warn'
            : 'info',
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    },
  };
}
