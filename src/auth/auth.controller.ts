import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto, RefreshTokenDto, TokenPairResponse } from './auth.dto.js';
import type { PublicUser } from '../users/users.service.js';
import { UserResponse } from '../users/user.response.js';
import { AuthService, type TokenPair } from './auth.service.js';
import { CurrentUser, Public } from './decorators.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairResponse })
  @ApiUnauthorizedResponse({
    description: 'Token inválido, expirado o reutilizado',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Sesión cerrada' })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponse })
  @ApiUnauthorizedResponse({ description: 'Falta el token o no es válido' })
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
