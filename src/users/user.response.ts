import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';

/** Usuario tal como lo devuelve la API: nunca incluye el hash. */
export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'operador@inventario.test' })
  email!: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role!: Role;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
