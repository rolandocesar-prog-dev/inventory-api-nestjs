import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  const getOrThrow = vi.fn(() => 'postgresql://u:p@localhost:5432/db');
  const config = { getOrThrow } as unknown as ConfigService;

  it('lee DATABASE_URL de la configuración', () => {
    new PrismaService(config);

    expect(getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
  });

  it('conecta al iniciar el módulo y desconecta al destruirlo', async () => {
    const service = new PrismaService(config);
    const connect = vi
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as never);
    const disconnect = vi
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined as never);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
