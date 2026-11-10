import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';
import { PageMeta, PaginationQueryDto } from '../common/pagination.js';
import { MovementResponse } from './stock.dto.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class KardexQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description:
      'Desde (inclusive). Una fecha sola es el inicio del día en UTC.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description:
      'Hasta (inclusive). Una fecha sola es el final del día en UTC.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

/** Convierte `from`/`to` en instantes; una fecha sola cubre el día completo. */
export function kardexRange(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) {
    range.lte = DATE_ONLY.test(to)
      ? new Date(`${to}T23:59:59.999Z`)
      : new Date(to);
  }
  return range;
}

export class KardexResponse {
  @ApiProperty({ type: [MovementResponse] })
  data!: MovementResponse[];

  @ApiProperty({ type: PageMeta })
  meta!: PageMeta;
}
