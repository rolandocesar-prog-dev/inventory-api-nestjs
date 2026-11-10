import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CategoryDto {
  @ApiProperty({ example: 'Herramientas', minLength: 2, maxLength: 60 })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/\S/, { message: 'name no puede estar vacío' })
  name!: string;
}

export class CategoryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Herramientas' })
  name!: string;
}
