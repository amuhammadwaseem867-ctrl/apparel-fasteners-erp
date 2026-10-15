#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4e61fb4318099bcdfa31b4c022febbc8c69cf67ee658f9487e2d2b191104bfe6/contract';
import startContract from '../../snapshots/4e61fb4318099bcdfa31b4c022febbc8c69cf67ee658f9487e2d2b191104bfe6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8f46377bb2b97a99a4da64c442a3da1c14332f5185e59134653f729a6f5f34d0/contract';
import endContract from '../../snapshots/8f46377bb2b97a99a4da64c442a3da1c14332f5185e59134653f729a6f5f34d0/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'erp_login_attempt_counters',
        columns: [
          col('count', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('windowStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['key']),
          checkExpression('erp_login_attempt_counters_count_positive_e5a6c4f8', '"count" > 0'),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_login_attempt_counters',
        index: 'erp_login_attempt_counters_windowStart_idx_4944f72a',
        columns: ['windowStart'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
