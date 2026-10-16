#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/324164ae048b9cc0c36c6299e393796852f4a4288f671476e9fa01b23bdd1884/contract';
import startContract from '../../snapshots/324164ae048b9cc0c36c6299e393796852f4a4288f671476e9fa01b23bdd1884/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a39cbea48f2b55ecf80dac45815da339e22c8c0e97cf74d7c28b44021cb0ee15/contract';
import endContract from '../../snapshots/a39cbea48f2b55ecf80dac45815da339e22c8c0e97cf74d7c28b44021cb0ee15/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_order_lines',
        column: col('lineNo', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
