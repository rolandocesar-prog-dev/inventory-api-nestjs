import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const queryRawUnsafe = vi.fn();

  async function createController(): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule.forRoot({ logger: false })],
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          // Como el cliente real de PostgreSQL: $runCommandRaw solo existe en MongoDB.
          useValue: {
            $runCommandRaw: () =>
              Promise.reject(new Error('Use the mongodb provider')),
            $queryRawUnsafe: queryRawUnsafe,
          },
        },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  beforeEach(() => {
    queryRawUnsafe.mockReset();
  });

  it('responde ok cuando la base de datos contesta', async () => {
    queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    const controller = await createController();

    const result = await controller.check();

    expect(queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    expect(result).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('responde 503 con el detalle cuando la base de datos falla', async () => {
    queryRawUnsafe.mockRejectedValue(new Error('connection refused'));
    const controller = await createController();

    const error: unknown = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      status: 'error',
      error: { database: { status: 'down' } },
    });
  });
});
