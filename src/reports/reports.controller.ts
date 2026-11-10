import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/client.js';
import { InventoryValueResponse, LowStockResponse } from './reports.dto.js';
import {
  ReportsService,
  type InventoryValue,
  type LowStockItem,
} from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Solo admin' })
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('low-stock')
  @ApiOkResponse({ type: [LowStockResponse] })
  lowStock(): Promise<LowStockItem[]> {
    return this.reports.lowStock();
  }

  @Get('inventory-value')
  @ApiOkResponse({ type: InventoryValueResponse })
  inventoryValue(): Promise<InventoryValue> {
    return this.reports.inventoryValue();
  }
}
