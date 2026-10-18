#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1f0fe750af6e14ac628139010801f61afe87e164e8bf3e7deebf8ffbf686d9ba/contract';
import startContract from '../../snapshots/1f0fe750af6e14ac628139010801f61afe87e164e8bf3e7deebf8ffbf686d9ba/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/876e9e0711ad12eea8ec695fb6728383d2646357682140e064f17811d73a4ccc/contract';
import endContract from '../../snapshots/876e9e0711ad12eea8ec695fb6728383d2646357682140e064f17811d73a4ccc/contract.json' with { type: 'json' };
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
        table: 'erp_production_stage_checks',
        columns: [
          col('checkKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('checkedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('checkedBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productionOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('result', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('value', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_production_stage_checks_result_9ec6f2d4',
            `"result" IN ('PASS', 'FAIL', 'NA')`,
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_production_stages',
        column: col('completionNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_stage_checks',
        constraint: 'erp_production_stage_checks_productionOrderId_stageKey_checkKey_key',
        columns: ['productionOrderId', 'stageKey', 'checkKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_stage_checks',
        index: 'erp_production_stage_checks_productionOrderId_idx_6ada58cc',
        columns: ['productionOrderId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_production_stage_checks',
        foreignKey: {
          name: 'erp_production_stage_checks_productionOrderId_fkey',
          columns: ['productionOrderId'],
          references: { schema: 'public', table: 'erp_production_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
