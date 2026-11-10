import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Tiempo máximo para que la base responda al `SELECT 1` del chequeo. */
export const DATABASE_PING_TIMEOUT_MS = 1500;

/**
 * Salud de la API y de la base de datos (RF-05), para Docker, el despliegue
 * y el monitoreo. Responde 503 si alguna dependencia falla.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.db
          .pingCheck('database', this.prisma)
          .withTimeout(DATABASE_PING_TIMEOUT_MS),
    ]);
  }
}
