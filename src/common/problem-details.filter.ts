import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Cuerpo de error según RFC 9457 (problem details). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: string[];
  requestId?: string;
}

const TITLES: Record<number, string> = {
  400: 'Petición inválida',
  401: 'No autenticado',
  403: 'Prohibido',
  404: 'No encontrado',
  409: 'Conflicto',
  413: 'Petición demasiado grande',
  415: 'Tipo de contenido no admitido',
  422: 'No se puede procesar',
  429: 'Demasiadas peticiones',
  500: 'Error interno',
  503: 'Servicio no disponible',
};

const UNEXPECTED =
  'Ocurrió un error inesperado. Si persiste, informa el requestId.';

export function titleFor(status: number): string {
  return (
    TITLES[status] ??
    (status >= 500 ? 'Error del servidor' : 'Error en la petición')
  );
}

/** Errores de `http-errors` (p. ej. JSON mal formado) que son seguros de mostrar. */
interface ExposableError {
  status: number;
  expose: boolean;
  message: string;
}

function isExposable(error: unknown): error is ExposableError {
  const e = error as Partial<ExposableError> | null;
  return (
    typeof e === 'object' &&
    e !== null &&
    e.expose === true &&
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500
  );
}

/** Traduce cualquier excepción a problem details (specs/design.md §4). */
export function toProblem(
  exception: unknown,
  instance: string,
  requestId?: string,
): ProblemDetails {
  let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
  let detail = UNEXPECTED;
  let errors: string[] | undefined;

  if (exception instanceof HttpException) {
    status = exception.getStatus();
    const body = exception.getResponse();
    const message =
      typeof body === 'string' ? body : (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      errors = message.map(String);
      detail = 'La petición tiene datos inválidos';
    } else if (typeof message === 'string' && status < 500) {
      detail = message;
    } else if (status < 500) {
      detail = exception.message;
    }
  } else if (isExposable(exception)) {
    status = exception.status;
    detail =
      status === 400
        ? 'El cuerpo de la petición no es JSON válido'
        : exception.message;
  }

  return {
    type: 'about:blank',
    title: titleFor(status),
    status,
    detail,
    instance,
    ...(errors ? { errors } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: unknown }>();
    const response = http.getResponse<Response>();
    const path = request.originalUrl.split('?')[0] ?? request.originalUrl;

    // /health conserva el formato de terminus, que leen Docker y los monitores.
    if (path === '/health' && exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const requestId =
      typeof request.id === 'string' || typeof request.id === 'number'
        ? String(request.id)
        : undefined;
    const problem = toProblem(exception, path, requestId);
    if (problem.status >= 500) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : exception,
      );
    }
    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }
}
