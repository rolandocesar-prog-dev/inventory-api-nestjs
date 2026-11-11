import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { Logger } from 'nestjs-pino';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import type { EnvironmentVariables } from './config/env.validation.js';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida por main.ts y las pruebas e2e, para que ambos
 * levanten la aplicación exactamente igual.
 */
export function setupApp(app: INestApplication): void {
  const env = app.get(ConfigService<EnvironmentVariables, true>);

  // Todos los logs (también los de Nest) salen en JSON por pino (RNF-06).
  app.useLogger(app.get(Logger));

  const express = app.getHttpAdapter().getInstance() as Express;
  // No anunciar el framework en cada respuesta.
  express.disable('x-powered-by');
  // Detrás del proxy de la plataforma, la IP real llega en X-Forwarded-For (RNF-08).
  if (env.get('TRUST_PROXY', { infer: true })) {
    express.set('trust proxy', 1);
  }

  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableShutdownHooks();
  // Errores en formato RFC 9457 (problem details).
  app.useGlobalFilters(new ProblemDetailsFilter());
  // Rechaza campos desconocidos y convierte tipos según los DTO (RNF-01).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const document = new DocumentBuilder()
    .setTitle('Inventory API')
    .setDescription('API de inventario para pequeños comercios')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, document),
  );
}
