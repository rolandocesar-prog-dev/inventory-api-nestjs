import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { Logger } from 'nestjs-pino';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida por main.ts y las pruebas e2e, para que ambos
 * levanten la aplicación exactamente igual.
 */
export function setupApp(app: INestApplication): void {
  // Todos los logs (también los de Nest) salen en JSON por pino (RNF-06).
  app.useLogger(app.get(Logger));
  // No anunciar el framework en cada respuesta.
  (app.getHttpAdapter().getInstance() as Express).disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableShutdownHooks();
  // Rechaza campos desconocidos y convierte tipos según los DTO (RNF-01).
  // Errores en formato RFC 9457 (problem details).
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Inventory API')
    .setDescription('API de inventario para pequeños comercios')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
