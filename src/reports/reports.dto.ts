import { ApiProperty } from '@nestjs/swagger';
import { ProductResponse } from '../catalog/products.dto.js';

export class LowStockResponse extends ProductResponse {
  @ApiProperty({
    example: 3,
    description: 'Unidades que faltan para el mínimo',
  })
  missing!: number;
}

export class CategoryValueResponse {
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'Herramientas' })
  name!: string;

  @ApiProperty({ example: 12 })
  products!: number;

  @ApiProperty({ example: 340 })
  units!: number;

  @ApiProperty({ example: '15230.50' })
  value!: string;
}

export class InventoryValueResponse {
  @ApiProperty({ example: '48210.75', description: 'Texto con 2 decimales' })
  totalValue!: string;

  @ApiProperty({ example: 1250 })
  totalUnits!: number;

  @ApiProperty({ example: 40 })
  products!: number;

  @ApiProperty({ type: [CategoryValueResponse] })
  byCategory!: CategoryValueResponse[];
}
