import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

export class HealthResponse {
  status!: 'ok';
  uptimeSeconds!: number;
}

/**
 * Endpoint de salud para Docker, el despliegue y el monitoreo.
 * En el hito M1 se amplía con @nestjs/terminus para verificar la base de datos.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
