import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../generated/prisma/client.js';

export class CreateUserDto {
  @ApiProperty({ example: 'operador@inventario.test' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 10, maxLength: 128, example: 'una-clave-larga' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role', default: Role.OPERATOR })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'false desactiva al usuario y cierra sus sesiones',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
