#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a39cbea48f2b55ecf80dac45815da339e22c8c0e97cf74d7c28b44021cb0ee15/contract';
import startContract from '../../snapshots/a39cbea48f2b55ecf80dac45815da339e22c8c0e97cf74d7c28b44021cb0ee15/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d45f4f3a3c2e0ceb4506e824eb8deb6e4f56f32f59e87865f91cf894c3dc36d9/contract';
import endContract from '../../snapshots/d45f4f3a3c2e0ceb4506e824eb8deb6e4f56f32f59e87865f91cf894c3dc36d9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_order_lines',
        column: col('slider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_order_lines',
        column: col('teethType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
