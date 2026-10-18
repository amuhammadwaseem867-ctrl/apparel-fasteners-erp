#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1f0fe750af6e14ac628139010801f61afe87e164e8bf3e7deebf8ffbf686d9ba/contract';
import endContract from '../../snapshots/1f0fe750af6e14ac628139010801f61afe87e164e8bf3e7deebf8ffbf686d9ba/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d45f4f3a3c2e0ceb4506e824eb8deb6e4f56f32f59e87865f91cf894c3dc36d9/contract';
import startContract from '../../snapshots/d45f4f3a3c2e0ceb4506e824eb8deb6e4f56f32f59e87865f91cf894c3dc36d9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        column: col('bags', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        column: col('grossWeight', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        column: col('netWeight', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_gate_passes',
        column: col('referenceNo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        constraint: 'erp_gate_pass_lines_packing_bf1ed072',
        expression:
          '("bags" IS NULL OR "bags" >= 0) AND ("netWeight" IS NULL OR "netWeight" >= 0) AND ("grossWeight" IS NULL OR "grossWeight" >= 0)',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
