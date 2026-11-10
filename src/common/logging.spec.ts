import type { IncomingMessage, ServerResponse } from 'node:http';
import { Writable } from 'node:stream';
import type { ConfigService } from '@nestjs/config';
import { pino } from 'pino';
import { loggerOptions, REDACTED_PATHS, requestIdFor } from './logging.js';

function fakeHttp(header?: string) {
  const req = {
    headers: header === undefined ? {} : { 'x-request-id': header },
  } as unknown as IncomingMessage;
  const setHeader = vi.fn();
  const res = { setHeader } as unknown as ServerResponse;
  return { req, res, setHeader };
}

describe('requestIdFor', () => {
  it('reutiliza un X-Request-ID válido y lo devuelve en la respuesta', () => {
    const { req, res, setHeader } = fakeHttp('abc-123_X');

    expect(requestIdFor(req, res)).toBe('abc-123_X');
    expect(setHeader).toHaveBeenCalledWith('X-Request-ID', 'abc-123_X');
  });

  it.each([
    ['ausente', undefined],
    ['con caracteres raros', 'id\ninyectado'],
    ['demasiado largo', 'a'.repeat(65)],
  ])('genera un UUID si el recibido está %s', (_caso, header) => {
    const { req, res } = fakeHttp(header);

    expect(requestIdFor(req, res)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('loggerOptions', () => {
  it('toma el nivel de LOG_LEVEL', () => {
    const config = { get: () => 'warn' } as unknown as ConfigService<
      never,
      true
    >;
    const options = loggerOptions(config);

    expect(options.pinoHttp).toMatchObject({ level: 'warn' });
  });

  it('oculta tokens, cookies y contraseñas', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino(
      { redact: { paths: REDACTED_PATHS, censor: '[oculto]' } },
      stream,
    );

    logger.info({
      req: { headers: { authorization: 'Bearer secreto', cookie: 'sid=1' } },
      body: { password: 'clave-real', refreshToken: 'rt', accessToken: 'at' },
    });

    const line = lines.join('');
    for (const secret of [
      'Bearer secreto',
      'sid=1',
      'clave-real',
      '"rt"',
      '"at"',
    ]) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain('[oculto]');
  });
});
