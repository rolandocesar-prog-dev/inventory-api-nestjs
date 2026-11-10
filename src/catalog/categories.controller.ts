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
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/client.js';
import { CategoryDto, CategoryResponse } from './categories.dto.js';
import { CategoriesService, type CategoryView } from './categories.service.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOkResponse({ type: [CategoryResponse] })
  findAll(): Promise<CategoryView[]> {
    return this.categories.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiCreatedResponse({ type: CategoryResponse })
  @ApiConflictResponse({
    description: 'Ya existe una categoría con ese nombre',
  })
  @ApiForbiddenResponse({ description: 'Solo admin' })
  create(@Body() dto: CategoryDto): Promise<CategoryView> {
    return this.categories.create(dto.name);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOkResponse({ type: CategoryResponse })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada' })
  @ApiConflictResponse({
    description: 'Ya existe una categoría con ese nombre',
  })
  @ApiForbiddenResponse({ description: 'Solo admin' })
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoryDto,
  ): Promise<CategoryView> {
    return this.categories.rename(id, dto.name);
  }
}
