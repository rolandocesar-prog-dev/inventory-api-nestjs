import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MovementType } from '../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const MAX_QUANTITY = 1_000_000;

export class MovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: MAX_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Venta mostrador', maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class AdjustmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 37, minimum: 0, description: 'Stock contado' })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  countedStock!: number;

  @ApiProperty({ example: 'Conteo mensual: 2 unidades dañadas' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}

class MovementUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'operador@inventario.test' })
  email!: string;
}

export class MovementResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  type!: MovementType;

  @ApiProperty({ example: -3, description: 'Con signo: + entra, − sale' })
  quantity!: number;

  @ApiProperty({ example: 9 })
  stockAfter!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  reason!: string | null;

  @ApiProperty({ type: MovementUser })
  user!: MovementUser;

  @ApiProperty()
  createdAt!: Date;
}
