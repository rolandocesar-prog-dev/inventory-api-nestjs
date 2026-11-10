import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Variables de entorno que la API necesita para arrancar (specs/design.md §6). */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  // Tipo explícito: la conversión de texto a número usa los metadatos del tipo.
  PORT: number = 3000;

  @IsUrl({
    protocols: ['postgres', 'postgresql'],
    require_tld: false,
    require_protocol: true,
  })
  DATABASE_URL!: string;

  /** Firma de los tokens de acceso (HS256): al menos 32 caracteres aleatorios. */
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  /** Intentos de login por minuto y por IP (RNF-02). */
  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_LIMIT: number = 5;

  /** Nivel de los logs JSON (RNF-06). */
  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';
}

/**
 * Valida y convierte las variables de entorno. Si alguna falta o es inválida
 * lanza un error con sus nombres, nunca con sus valores (pueden ser secretos).
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const names = errors.map((error) => error.property).join(', ');
    throw new Error(
      `Variables de entorno inválidas o faltantes: ${names}. Revisa .env.example.`,
    );
  }
  return env;
}
