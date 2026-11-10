import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/client.js';
import type { PublicUser } from '../users/users.service.js';
import { AdjustmentDto, MovementDto, MovementResponse } from './stock.dto.js';
import { StockService, type MovementView } from './stock.service.js';

@ApiTags('stock')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: 'Producto no encontrado' })
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Post('in')
  @ApiCreatedResponse({ type: MovementResponse })
  @ApiUnprocessableEntityResponse({ description: 'Producto desactivado' })
  registerIn(
    @CurrentUser() user: PublicUser,
    @Body() dto: MovementDto,
  ): Promise<MovementView> {
    return this.stock.registerIn(user.id, dto);
  }

  @Post('out')
  @ApiCreatedResponse({ type: MovementResponse })
  @ApiUnprocessableEntityResponse({
    description: 'Stock insuficiente o producto desactivado',
  })
  registerOut(
    @CurrentUser() user: PublicUser,
    @Body() dto: MovementDto,
  ): Promise<MovementView> {
    return this.stock.registerOut(user.id, dto);
  }

  @Post('adjustments')
  @Roles(Role.ADMIN)
  @ApiCreatedResponse({ type: MovementResponse })
  @ApiUnprocessableEntityResponse({
    description: 'Sin diferencia con el stock actual o producto desactivado',
  })
  @ApiForbiddenResponse({ description: 'Solo admin' })
  adjust(
    @CurrentUser() user: PublicUser,
    @Body() dto: AdjustmentDto,
  ): Promise<MovementView> {
    return this.stock.adjust(user.id, dto);
  }
}
