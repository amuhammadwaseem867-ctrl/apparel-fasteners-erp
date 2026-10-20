#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2cf92c9acbd13c522550ad6f34e3d43ef7625863dcf10fc56c82c03111576914/contract';
import endContract from '../../snapshots/2cf92c9acbd13c522550ad6f34e3d43ef7625863dcf10fc56c82c03111576914/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/85b340e3f25dacd1bb2300e2beee55752023fb65c0e2f226252fb6b01bf989bb/contract';
import startContract from '../../snapshots/85b340e3f25dacd1bb2300e2beee55752023fb65c0e2f226252fb6b01bf989bb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_packing_packages',
        column: col('bags', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_packing_packages',
        column: col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_packing_packages',
        column: col('size', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'erp_packing_packages',
        constraint: 'erp_packing_packages_bags_positive_b5f20c6a',
        expression: '"bags" > 0',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
