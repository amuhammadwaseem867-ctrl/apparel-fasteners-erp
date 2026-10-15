#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8f46377bb2b97a99a4da64c442a3da1c14332f5185e59134653f729a6f5f34d0/contract';
import startContract from '../../snapshots/8f46377bb2b97a99a4da64c442a3da1c14332f5185e59134653f729a6f5f34d0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9acd9c9787f4d197375a61f9e6941f180d9b661fc3b773954cb0b8e08a4089cc/contract';
import endContract from '../../snapshots/9acd9c9787f4d197375a61f9e6941f180d9b661fc3b773954cb0b8e08a4089cc/contract.json' with { type: 'json' };
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
        table: 'erp_gate_pass_lines',
        columns: [
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('gatePassId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('returnedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_gate_pass_lines_quantities_4b674539',
            '"quantity" > 0 AND "returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_gate_passes',
        columns: [
          col('approvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('approvedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('cancelReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('cancelledBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('closedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('driverName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('expectedReturnDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('guardName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('partyName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('passedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('shipmentId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('vehicleNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_gate_passes_return_date_9ba70b37',
            `"passType" <> 'OUTWARD_RETURNABLE' OR "expectedReturnDate" IS NOT NULL`,
          ),
          checkExpression(
            'erp_gate_passes_status_178fea4e',
            `"status" IN ('DRAFT', 'APPROVED', 'OUT', 'COMPLETED', 'CANCELLED')`,
          ),
          checkExpression(
            'erp_gate_passes_type_5547c3b7',
            `"passType" IN ('INWARD', 'OUTWARD_NON_RETURNABLE', 'OUTWARD_RETURNABLE')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        constraint: 'erp_gate_pass_lines_gatePassId_lineNo_key',
        columns: ['gatePassId', 'lineNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_gate_passes',
        constraint: 'erp_gate_passes_passNumber_key',
        columns: ['passNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_gate_passes',
        constraint: 'erp_gate_passes_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        index: 'erp_gate_pass_lines_gatePassId_idx_c82c3393',
        columns: ['gatePassId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_gate_passes',
        index: 'erp_gate_passes_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_gate_passes',
        index: 'erp_gate_passes_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_gate_pass_lines',
        foreignKey: {
          name: 'erp_gate_pass_lines_gatePassId_fkey',
          columns: ['gatePassId'],
          references: { schema: 'public', table: 'erp_gate_passes', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
