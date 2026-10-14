#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3fbf924d1bf55acea5413e769f3ccc24312ed720241f50b7b06ae98d291af9ba/contract';
import startContract from '../../snapshots/3fbf924d1bf55acea5413e769f3ccc24312ed720241f50b7b06ae98d291af9ba/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eaef2dc450786c9586d2cce23a2c72fdd635e2ebf263df14df44e5cf85c7d427/contract';
import endContract from '../../snapshots/eaef2dc450786c9586d2cce23a2c72fdd635e2ebf263df14df44e5cf85c7d427/contract.json' with { type: 'json' };
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
        table: 'erp_bom_lines',
        columns: [
          col('bomId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('componentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('scrapPercent', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_bom_lines_quantity_positive_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_bom_lines_scrap_range_d81a53cf',
            '"scrapPercent" >= 0 AND "scrapPercent" < 100',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_boms',
        columns: [
          col('approvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('approvedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('effectiveFrom', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('revision', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_boms_active_is_approved_18756da6',
            `NOT "isActive" OR "status" = 'APPROVED'`,
          ),
          checkExpression('erp_boms_revision_positive_6165c89f', '"revision" >= 1'),
          checkExpression(
            'erp_boms_status_dc1330ee',
            `"status" IN ('DRAFT', 'APPROVED', 'OBSOLETE')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_mrp_demands',
        columns: [
          col('dueDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('orderNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('runId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('salesOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('salesOrderLineId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_mrp_planned_orders',
        columns: [
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('confirmedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('dueDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('orderType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('runId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('SUGGESTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_mrp_planned_orders_quantity_positive_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_mrp_planned_orders_status_d57f47da',
            `"status" IN ('SUGGESTED', 'CONFIRMED', 'CANCELLED')`,
          ),
          checkExpression('erp_mrp_planned_orders_type_1ef73df2', `"orderType" IN ('MAKE', 'BUY')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_mrp_requirements',
        columns: [
          col('allocatedStock', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('availableStock', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('bomId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('bomRevision', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('grossRequirement', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lowLevelCode', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('netRequirement', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('plannedQuantity', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('runId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('supplyType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_mrp_requirements_supply_type_257b3fb3',
            `"supplyType" IN ('MAKE', 'BUY')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_mrp_runs',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('demandCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('parameters', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('plannedCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('runNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('COMPLETED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_bom_lines',
        constraint: 'erp_bom_lines_bomId_componentId_key',
        columns: ['bomId', 'componentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_bom_lines',
        constraint: 'erp_bom_lines_bomId_lineNo_key',
        columns: ['bomId', 'lineNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_boms',
        constraint: 'erp_boms_productId_revision_key',
        columns: ['productId', 'revision'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_mrp_requirements',
        constraint: 'erp_mrp_requirements_runId_productId_key',
        columns: ['runId', 'productId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_mrp_runs',
        constraint: 'erp_mrp_runs_runNumber_key',
        columns: ['runNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_bom_lines',
        index: 'erp_bom_lines_bomId_idx_7a62fe8b',
        columns: ['bomId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_bom_lines',
        index: 'erp_bom_lines_componentId_idx_34539a70',
        columns: ['componentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_boms',
        index: 'erp_boms_one_active_per_product_c9dc9844',
        columns: ['productId'],
        extras: { where: '"isActive"', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_demands',
        index: 'erp_mrp_demands_runId_idx_a6016437',
        columns: ['runId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_planned_orders',
        index: 'erp_mrp_planned_orders_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_planned_orders',
        index: 'erp_mrp_planned_orders_runId_idx_a6016437',
        columns: ['runId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_planned_orders',
        index: 'erp_mrp_planned_orders_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_requirements',
        index: 'erp_mrp_requirements_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_requirements',
        index: 'erp_mrp_requirements_runId_idx_a6016437',
        columns: ['runId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_mrp_runs',
        index: 'erp_mrp_runs_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_bom_lines',
        foreignKey: {
          name: 'erp_bom_lines_bomId_fkey',
          columns: ['bomId'],
          references: { schema: 'public', table: 'erp_boms', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_bom_lines',
        foreignKey: {
          name: 'erp_bom_lines_componentId_fkey',
          columns: ['componentId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_boms',
        foreignKey: {
          name: 'erp_boms_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_mrp_demands',
        foreignKey: {
          name: 'erp_mrp_demands_runId_fkey',
          columns: ['runId'],
          references: { schema: 'public', table: 'erp_mrp_runs', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_mrp_planned_orders',
        foreignKey: {
          name: 'erp_mrp_planned_orders_runId_fkey',
          columns: ['runId'],
          references: { schema: 'public', table: 'erp_mrp_runs', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_mrp_planned_orders',
        foreignKey: {
          name: 'erp_mrp_planned_orders_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_mrp_requirements',
        foreignKey: {
          name: 'erp_mrp_requirements_runId_fkey',
          columns: ['runId'],
          references: { schema: 'public', table: 'erp_mrp_runs', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_mrp_requirements',
        foreignKey: {
          name: 'erp_mrp_requirements_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
