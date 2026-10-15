#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/18f21701327e7468d411506fd34b155534332c720aae339e2d13f0e6eb8eb966/contract';
import startContract from '../../snapshots/18f21701327e7468d411506fd34b155534332c720aae339e2d13f0e6eb8eb966/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/650af9c793258402fb36b28d3bf8dcdcb91ede3869a7a60bf0f64a9b70b74026/contract';
import endContract from '../../snapshots/650af9c793258402fb36b28d3bf8dcdcb91ede3869a7a60bf0f64a9b70b74026/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_salary_advances',
        column: col('idempotencyKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_salary_advances',
        constraint: 'erp_salary_advances_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
