import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/client.js';
import type { Paginated } from '../common/pagination.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  ProductPageResponse,
  ProductResponse,
  UpdateProductDto,
} from './products.dto.js';
import { ProductsService, type ProductView } from './products.service.js';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: ProductPageResponse })
  list(@Query() query: ListProductsQueryDto): Promise<Paginated<ProductView>> {
    return this.products.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductView> {
    return this.products.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiCreatedResponse({ type: ProductResponse })
  @ApiConflictResponse({ description: 'Ya existe un producto con ese SKU' })
  @ApiUnprocessableEntityResponse({ description: 'La categoría no existe' })
  @ApiForbiddenResponse({ description: 'Solo admin' })
  create(@Body() dto: CreateProductDto): Promise<ProductView> {
    return this.products.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiConflictResponse({ description: 'Ya existe un producto con ese SKU' })
  @ApiUnprocessableEntityResponse({ description: 'La categoría no existe' })
  @ApiForbiddenResponse({ description: 'Solo admin' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductView> {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Producto desactivado (no se borra)' })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiForbiddenResponse({ description: 'Solo admin' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.products.deactivate(id);
  }
}
