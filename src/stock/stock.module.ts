import { Module } from '@nestjs/common';
import { KardexController } from './kardex.controller.js';
import { KardexService } from './kardex.service.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

@Module({
  controllers: [StockController, KardexController],
  providers: [StockService, KardexService],
})
export class StockModule {}
