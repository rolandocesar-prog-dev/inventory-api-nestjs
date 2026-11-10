import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@inventario.test' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'una-clave-larga' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Token de renovación recibido en el login' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken!: string;
}

export class TokenPairResponse {
  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'JWT para la cabecera Authorization' })
  accessToken!: string;

  @ApiProperty({
    example: 900,
    description: 'Segundos de validez del token de acceso',
  })
  expiresIn!: number;

  @ApiProperty({ description: 'Token de renovación (7 días, de un solo uso)' })
  refreshToken!: string;
}
