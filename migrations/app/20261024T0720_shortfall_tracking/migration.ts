#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/09a6210e3ab8fa953347f8644d35725ff96b4bf7fde3fea3fa9c9ecac4112343/contract';
import endContract from '../../snapshots/09a6210e3ab8fa953347f8644d35725ff96b4bf7fde3fea3fa9c9ecac4112343/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2dc5f2f81570adbedc3799970d313ff7a22720387a95ce83b02eb9f1ac192918/contract';
import startContract from '../../snapshots/2dc5f2f81570adbedc3799970d313ff7a22720387a95ce83b02eb9f1ac192918/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'erp_shortfalls',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('resolvedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('resolvedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('salesOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('salesOrderLineId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_shortfalls_quantities_2d9cfd39',
            '"quantity" > 0 AND "resolvedQuantity" >= 0 AND "resolvedQuantity" <= "quantity"',
          ),
          checkExpression(
            'erp_shortfalls_resolved_needs_date_c980bd89',
            `"status" <> 'RESOLVED' OR "resolvedAt" IS NOT NULL`,
          ),
          checkExpression(
            'erp_shortfalls_status_054ddf75',
            `"status" IN ('OPEN', 'RESOLVED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shortfalls',
        index: 'erp_shortfalls_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shortfalls',
        index: 'erp_shortfalls_salesOrderId_idx_0f1a116c',
        columns: ['salesOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shortfalls',
        index: 'erp_shortfalls_salesOrderId_status_idx_a5b16527',
        columns: ['salesOrderId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shortfalls',
        index: 'erp_shortfalls_salesOrderLineId_idx_47ed3c92',
        columns: ['salesOrderLineId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_shortfalls',
        foreignKey: {
          name: 'erp_shortfalls_salesOrderId_fkey',
          columns: ['salesOrderId'],
          references: { schema: 'public', table: 'erp_sales_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_shortfalls',
        foreignKey: {
          name: 'erp_shortfalls_salesOrderLineId_fkey',
          columns: ['salesOrderLineId'],
          references: { schema: 'public', table: 'erp_sales_order_lines', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_shortfalls',
        foreignKey: {
          name: 'erp_shortfalls_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
