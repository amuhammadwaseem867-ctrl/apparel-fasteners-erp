#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/eaef2dc450786c9586d2cce23a2c72fdd635e2ebf263df14df44e5cf85c7d427/contract';
import startContract from '../../snapshots/eaef2dc450786c9586d2cce23a2c72fdd635e2ebf263df14df44e5cf85c7d427/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fe44d181b57784cb63bc1565012cf6ece90ff2ec5d4aa39175b71ddc8e44153e/contract';
import endContract from '../../snapshots/fe44d181b57784cb63bc1565012cf6ece90ff2ec5d4aa39175b71ddc8e44153e/contract.json' with { type: 'json' };
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
        table: 'erp_production_events',
        columns: [
          col('actorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fromValue', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('productionOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('stageKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('toValue', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_production_orders',
        columns: [
          col('bomId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('bomRevision', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('currentStage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dueDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('holdFromStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('orderNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('plannedOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('NORMAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('salesOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('salesOrderLineId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PLANNED'),
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
            'erp_production_orders_priority_72dbae57',
            `"priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')`,
          ),
          checkExpression('erp_production_orders_quantity_positive_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_production_orders_status_83d7023d',
            `"status" IN ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_production_stage_runs',
        columns: [
          col('acceptedQuantity', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inputQuantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('operatorName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('recordedBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('rejectedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('remarks', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reworkQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('runNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stageId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('wastageQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('workstation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_production_stage_runs_balance_d739712f',
            '"inputQuantity" = "acceptedQuantity" + "rejectedQuantity" + "wastageQuantity" + "reworkQuantity"',
          ),
          checkExpression(
            'erp_production_stage_runs_quantities_14455bea',
            '"inputQuantity" > 0 AND "acceptedQuantity" >= 0 AND "rejectedQuantity" >= 0 AND "wastageQuantity" >= 0 AND "reworkQuantity" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_production_stages',
        columns: [
          col('acceptedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('department', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('processedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('productionOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('rejectedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('responsibleName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reworkQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('sequence', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('wastageQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_production_stages_balance_12ff3e15',
            '"processedQuantity" = "acceptedQuantity" + "rejectedQuantity" + "wastageQuantity" + "reworkQuantity"',
          ),
          checkExpression(
            'erp_production_stages_nonnegative_6dcf757b',
            '"acceptedQuantity" >= 0 AND "rejectedQuantity" >= 0 AND "wastageQuantity" >= 0 AND "reworkQuantity" >= 0',
          ),
          checkExpression('erp_production_stages_sequence_857ff137', '"sequence" BETWEEN 1 AND 9'),
          checkExpression(
            'erp_production_stages_status_c95d195d',
            `"status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_orders',
        constraint: 'erp_production_orders_orderNumber_key',
        columns: ['orderNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_orders',
        constraint: 'erp_production_orders_plannedOrderId_key',
        columns: ['plannedOrderId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_stage_runs',
        constraint: 'erp_production_stage_runs_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_stage_runs',
        constraint: 'erp_production_stage_runs_stageId_runNo_key',
        columns: ['stageId', 'runNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_stages',
        constraint: 'erp_production_stages_productionOrderId_stageKey_key',
        columns: ['productionOrderId', 'stageKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_stages',
        constraint: 'erp_production_stages_productionOrderId_sequence_key',
        columns: ['productionOrderId', 'sequence'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_events',
        index: 'erp_production_events_productionOrderId_createdAt_idx_81e7ba11',
        columns: ['productionOrderId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_events',
        index: 'erp_production_events_productionOrderId_idx_6ada58cc',
        columns: ['productionOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_orders',
        index: 'erp_production_orders_dueDate_idx_fb527616',
        columns: ['dueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_orders',
        index: 'erp_production_orders_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_orders',
        index: 'erp_production_orders_salesOrderId_idx_0f1a116c',
        columns: ['salesOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_orders',
        index: 'erp_production_orders_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_stage_runs',
        index: 'erp_production_stage_runs_stageId_idx_43a99835',
        columns: ['stageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_stages',
        index: 'erp_production_stages_productionOrderId_idx_6ada58cc',
        columns: ['productionOrderId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_production_events',
        foreignKey: {
          name: 'erp_production_events_productionOrderId_fkey',
          columns: ['productionOrderId'],
          references: { schema: 'public', table: 'erp_production_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_production_orders',
        foreignKey: {
          name: 'erp_production_orders_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_production_stage_runs',
        foreignKey: {
          name: 'erp_production_stage_runs_stageId_fkey',
          columns: ['stageId'],
          references: { schema: 'public', table: 'erp_production_stages', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_production_stages',
        foreignKey: {
          name: 'erp_production_stages_productionOrderId_fkey',
          columns: ['productionOrderId'],
          references: { schema: 'public', table: 'erp_production_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
