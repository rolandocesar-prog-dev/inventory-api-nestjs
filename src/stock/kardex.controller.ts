import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Paginated } from '../common/pagination.js';
import { KardexQueryDto, KardexResponse } from './kardex.dto.js';
import { KardexService } from './kardex.service.js';
import type { MovementView } from './stock.service.js';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('products/:id/movements')
export class KardexController {
  constructor(private readonly kardex: KardexService) {}

  @Get()
  @ApiOkResponse({ type: KardexResponse, description: 'Kardex del producto' })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiBadRequestResponse({ description: 'Fechas inválidas o from > to' })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: KardexQueryDto,
  ): Promise<Paginated<MovementView>> {
    return this.kardex.forProduct(id, query);
  }
}
