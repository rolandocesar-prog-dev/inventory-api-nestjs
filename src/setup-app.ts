import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const API_PREFIX = 'api/v1';

/**
 * Configuración compartida por main.ts y las pruebas e2e, para que ambos
 * levanten la aplicación exactamente igual.
 */
export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableShutdownHooks();
  // Rechaza campos desconocidos y convierte tipos según los DTO (RNF-01).
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
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
