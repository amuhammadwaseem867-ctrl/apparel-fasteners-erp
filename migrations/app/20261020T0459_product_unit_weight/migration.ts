#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3ab6ea3e77f8b90d2533e3ee42cb4c88ee3aa06fedb1740aed6431289f03eed6/contract';
import startContract from '../../snapshots/3ab6ea3e77f8b90d2533e3ee42cb4c88ee3aa06fedb1740aed6431289f03eed6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/85b340e3f25dacd1bb2300e2beee55752023fb65c0e2f226252fb6b01bf989bb/contract';
import endContract from '../../snapshots/85b340e3f25dacd1bb2300e2beee55752023fb65c0e2f226252fb6b01bf989bb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('unitWeightGrams', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'erp_products',
        constraint: 'erp_products_unit_weight_positive_8a21c44a',
        expression: '"unitWeightGrams" IS NULL OR "unitWeightGrams" > 0',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
