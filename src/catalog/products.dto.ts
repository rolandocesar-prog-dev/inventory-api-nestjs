import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageMeta, PaginationQueryDto } from '../common/pagination.js';
import { CategoryResponse } from './categories.dto.js';

const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProductDto {
  @ApiProperty({ example: 'MART-001', description: 'Se guarda en mayúsculas' })
  @Transform(trimUpper)
  @IsString()
  @Matches(/^[A-Z0-9-]{3,32}$/, {
    message: 'sku debe tener de 3 a 32 letras, números o guiones',
  })
  sku!: string;

  @ApiProperty({ example: 'Martillo de carpintero 16 oz' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 45.5, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(9_999_999_999.99)
  price!: number;

  @ApiPropertyOptional({ example: 5, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  minStock?: number;
}

/** El stock no está: solo cambia con movimientos (RF-03). */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ description: 'false lo desactiva; true lo reactiva' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ProductResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'MART-001' })
  sku!: string;

  @ApiProperty({ example: 'Martillo de carpintero 16 oz' })
  name!: string;

  @ApiProperty({ type: CategoryResponse })
  category!: CategoryResponse;

  @ApiProperty({ example: '45.50', description: 'Texto con 2 decimales' })
  price!: string;

  @ApiProperty({ example: 12 })
  stock!: number;

  @ApiProperty({ example: 5 })
  minStock!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca en el nombre y el SKU' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Incluir los desactivados',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeInactive: boolean = false;
}

export class ProductPageResponse {
  @ApiProperty({ type: [ProductResponse] })
  data!: ProductResponse[];

  @ApiProperty({ type: PageMeta })
  meta!: PageMeta;
}
