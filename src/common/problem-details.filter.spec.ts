import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
  type ArgumentsHost,
} from '@nestjs/common';
import {
  ProblemDetailsFilter,
  titleFor,
  toProblem,
} from './problem-details.filter.js';

describe('toProblem', () => {
  it('usa el mensaje de una excepción HTTP como detail', () => {
    expect(
      toProblem(
        new UnprocessableEntityException('Stock insuficiente'),
        '/api/v1/stock/out',
        'r1',
      ),
    ).toEqual({
      type: 'about:blank',
      title: 'No se puede procesar',
      status: 422,
      detail: 'Stock insuficiente',
      instance: '/api/v1/stock/out',
      requestId: 'r1',
    });
  });

  it('pasa los mensajes de validación a errors', () => {
    const problem = toProblem(
      new BadRequestException(['sku es inválido', 'price debe ser ≥ 0']),
      '/x',
    );

    expect(problem).toMatchObject({
      status: 400,
      detail: 'La petición tiene datos inválidos',
      errors: ['sku es inválido', 'price debe ser ≥ 0'],
    });
    expect(problem).not.toHaveProperty('requestId');
  });

  it('acepta excepciones con cuerpo de texto o sin mensaje', () => {
    expect(toProblem(new HttpException('Texto', 409), '/x').detail).toBe(
      'Texto',
    );
    expect(toProblem(new HttpException({ otra: 1 }, 404), '/x').detail).toBe(
      'Http Exception',
    );
  });

  it('un error no previsto responde 500 sin filtrar detalles internos', () => {
    const problem = toProblem(
      new Error('password=secreta en la consulta'),
      '/x',
    );

    expect(problem.status).toBe(500);
    expect(problem.detail).not.toContain('secreta');
    expect(
      toProblem(new InternalServerErrorException('detalle interno'), '/x')
        .detail,
    ).not.toContain('interno');
  });

  it('el JSON mal formado (http-errors con expose) responde 400', () => {
    const parseError = Object.assign(new Error('Unexpected token'), {
      status: 400,
      expose: true,
    });

    expect(toProblem(parseError, '/x')).toMatchObject({
      status: 400,
      detail: 'El cuerpo de la petición no es JSON válido',
    });
    expect(
      toProblem(
        Object.assign(new Error('too large'), { status: 413, expose: true }),
        '/x',
      ),
    ).toMatchObject({ status: 413, title: 'Petición demasiado grande' });
  });

  it('tiene títulos genéricos para los estados sin traducción', () => {
    expect(titleFor(418)).toBe('Error en la petición');
    expect(titleFor(502)).toBe('Error del servidor');
  });
});

describe('ProblemDetailsFilter', () => {
  function hostFor(originalUrl: string, id?: string) {
    const response = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl, id }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    return { host, response };
  }

  it('responde application/problem+json sin la consulta en instance', () => {
    const { host, response } = hostFor('/api/v1/products/x?page=2', 'r1');

    new ProblemDetailsFilter().catch(
      new NotFoundException('Producto no encontrado'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        instance: '/api/v1/products/x',
        requestId: 'r1',
      }),
    );
  });

  it('deja el formato de terminus en /health', () => {
    const { host, response } = hostFor('/health');
    const body = { status: 'error', error: { database: { status: 'down' } } };

    new ProblemDetailsFilter().catch(new HttpException(body, 503), host);

    expect(response.json).toHaveBeenCalledWith(body);
    expect(response.type).not.toHaveBeenCalled();
  });

  it('registra los errores 500', () => {
    const { host } = hostFor('/x');
    const filter = new ProblemDetailsFilter();
    const error = vi
      .spyOn(
        (filter as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    filter.catch(new Error('falló'), host);

    expect(error).toHaveBeenCalledOnce();
  });
});
