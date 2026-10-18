#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/876e9e0711ad12eea8ec695fb6728383d2646357682140e064f17811d73a4ccc/contract';
import startContract from '../../snapshots/876e9e0711ad12eea8ec695fb6728383d2646357682140e064f17811d73a4ccc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/939c3cc63fb943ed04b1ef8cccf531d06faa371d440c9d678f7a94330a2ee516/contract';
import endContract from '../../snapshots/939c3cc63fb943ed04b1ef8cccf531d06faa371d440c9d678f7a94330a2ee516/contract.json' with { type: 'json' };
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
        table: 'erp_sales_order_notes',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('note', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('salesOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('step', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_sales_order_notes_step_46695d45',
            `"step" IN ('order', 'production', 'qc', 'packing', 'dispatch', 'invoice', 'payment')`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_sales_order_notes',
        index: 'erp_sales_order_notes_salesOrderId_createdAt_idx_332b57b3',
        columns: ['salesOrderId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_sales_order_notes',
        index: 'erp_sales_order_notes_salesOrderId_idx_0f1a116c',
        columns: ['salesOrderId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_sales_order_notes',
        foreignKey: {
          name: 'erp_sales_order_notes_salesOrderId_fkey',
          columns: ['salesOrderId'],
          references: { schema: 'public', table: 'erp_sales_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
