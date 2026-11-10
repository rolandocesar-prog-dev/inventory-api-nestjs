import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/client.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UserResponse } from './user.response.js';
import { UsersService, type PublicUser } from './users.service.js';

/** Gestión de usuarios: solo admin (RF-01). */
@ApiTags('users')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Solo un admin puede gestionar usuarios' })
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiCreatedResponse({ type: UserResponse })
  @ApiConflictResponse({ description: 'El correo ya existe' })
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.users.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [UserResponse] })
  findAll(): Promise<PublicUser[]> {
    return this.users.findAll();
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @ApiUnprocessableEntityResponse({
    description: 'Un admin no puede desactivarse ni quitarse el rol',
  })
  update(
    @CurrentUser() actor: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<PublicUser> {
    return this.users.update(actor.id, id, dto);
  }
}
