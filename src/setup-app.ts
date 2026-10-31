import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida por main.ts y las pruebas e2e, para que ambos
 * levanten la aplicación exactamente igual.
 */
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Inventory API')
    .setDescription('API de inventario para pequeños comercios')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
