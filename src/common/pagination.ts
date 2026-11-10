import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}

export class PageMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export function pageMeta(
  page: number,
  pageSize: number,
  total: number,
): PageMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/** `skip` y `take` de Prisma para una página. */
export function pageArgs(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
