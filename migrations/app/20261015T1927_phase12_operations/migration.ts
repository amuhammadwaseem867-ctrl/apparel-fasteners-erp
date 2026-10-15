#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0384763eb0940887c2363fe1cf81b0ce97c46ab12ee7774ec4bc34b4d2a325de/contract';
import startContract from '../../snapshots/0384763eb0940887c2363fe1cf81b0ce97c46ab12ee7774ec4bc34b4d2a325de/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8aeedc4fd6f3349fbed4f1cde04011c0594649daeda6416d28526f0d36218ae1/contract';
import endContract from '../../snapshots/8aeedc4fd6f3349fbed4f1cde04011c0594649daeda6416d28526f0d36218ae1/contract.json' with { type: 'json' };
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
        table: 'erp_app_settings',
        columns: [
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['key'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_batches',
        columns: [
          col('batchNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('expiresOn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('madeOn', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('productionOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('purchaseReceiptId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('sourceType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('supplierLotRef', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_batches_dates_781ad94d',
            '"expiresOn" IS NULL OR "expiresOn" >= "madeOn"',
          ),
          checkExpression('erp_batches_quantity_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_batches_source_41609188',
            `"sourceType" IN ('PRODUCTION', 'PURCHASE', 'OPENING')`,
          ),
          checkExpression(
            'erp_batches_status_d357ef7b',
            `"status" IN ('ACTIVE', 'ON_HOLD', 'RELEASED', 'REJECTED', 'CONSUMED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_calendar_days',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('date', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dayType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_calendar_days_type_a1bf6376',
            `"dayType" IN ('HOLIDAY', 'SHUTDOWN', 'WORKING')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_capas',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actionType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('capaNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('completionNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('dueDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ncrId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('ownerName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('verificationNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('verifiedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('verifiedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_capas_status_bca129da',
            `"status" IN ('OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED')`,
          ),
          checkExpression(
            'erp_capas_type_eca50f56',
            `"actionType" IN ('CORRECTIVE', 'PREVENTIVE')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_leave_requests',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('days', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('decidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('decidedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('decisionNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('fromDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaveTypeId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('toDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_leave_requests_dates_5f46a36a',
            '"toDate" >= "fromDate" AND "days" > 0',
          ),
          checkExpression(
            'erp_leave_requests_status_57fe5f48',
            `"status" IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_leave_types',
        columns: [
          col('annualDays', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paid', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_leave_types_days_fb514958',
            '"annualDays" >= 0 AND "annualDays" <= 366',
          ),
          checkExpression('erp_leave_types_status_ee520df2', `"status" IN ('ACTIVE', 'INACTIVE')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_ncrs',
        columns: [
          col('closeNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('closedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('closedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('containment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('customerId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('disposition', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inspectionId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('ncrNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('productionOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantityAffected', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('rootCause', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('supplierId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_ncrs_disposition_c259db1c',
            `"disposition" IS NULL OR "disposition" IN ('REWORK', 'SCRAP', 'USE_AS_IS', 'RETURN_TO_SUPPLIER', 'REGRADE')`,
          ),
          checkExpression(
            'erp_ncrs_quantity_01ebca41',
            '"quantityAffected" IS NULL OR "quantityAffected" > 0',
          ),
          checkExpression(
            'erp_ncrs_severity_e3c48749',
            `"severity" IN ('MINOR', 'MAJOR', 'CRITICAL')`,
          ),
          checkExpression(
            'erp_ncrs_source_f09274fc',
            `"source" IN ('INSPECTION', 'IN_PROCESS', 'CUSTOMER', 'SUPPLIER', 'INTERNAL')`,
          ),
          checkExpression(
            'erp_ncrs_status_3c5226f6',
            `"status" IN ('OPEN', 'INVESTIGATING', 'CLOSED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_packing_instructions',
        columns: [
          col('cartonType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('customerId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('instructions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('labelling', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('packType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('packsPerCarton', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('unitsPerPack', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_packing_instructions_quantities_ac11af64',
            '"unitsPerPack" > 0 AND "packsPerCarton" > 0',
          ),
          checkExpression(
            'erp_packing_instructions_status_ee520df2',
            `"status" IN ('ACTIVE', 'INACTIVE')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_product_categories',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_product_categories_status_ee520df2',
            `"status" IN ('ACTIVE', 'INACTIVE')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_product_documents',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('archivedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('content', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('documentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('sha256', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sizeBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uploadedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('uploadedBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_product_documents_size_37f354af',
            '"sizeBytes" > 0 AND "sizeBytes" <= 5242880',
          ),
          checkExpression(
            'erp_product_documents_status_aef30f3b',
            `"status" IN ('ACTIVE', 'ARCHIVED')`,
          ),
          checkExpression(
            'erp_product_documents_type_2b38851f',
            `"documentType" IN ('SPECIFICATION', 'DRAWING', 'TEST_REPORT', 'CERTIFICATE', 'IMAGE', 'OTHER')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_product_price_changes',
        columns: [
          col('changedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('changedBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('effectiveDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('newPrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('previousPrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_product_price_changes_nonnegative_653eab89',
            '"newPrice" >= 0 AND "previousPrice" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_production_plan_lines',
        columns: [
          col('dueDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('planId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('NORMAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('productionOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PLANNED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_production_plan_lines_priority_72dbae57',
            `"priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')`,
          ),
          checkExpression('erp_production_plan_lines_quantity_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_production_plan_lines_status_f23dda36',
            `"status" IN ('PLANNED', 'RELEASING', 'RELEASED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_production_plans',
        columns: [
          col('approvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('approvedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('periodEnd', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('periodStart', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('planNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_production_plans_period_a4b7382c', '"periodEnd" >= "periodStart"'),
          checkExpression(
            'erp_production_plans_status_c831a02a',
            `"status" IN ('DRAFT', 'APPROVED', 'CLOSED', 'CANCELLED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_shifts',
        columns: [
          col('breakMinutes', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endTime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startTime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_shifts_break_592e88e3', '"breakMinutes" BETWEEN 0 AND 240'),
          checkExpression('erp_shifts_status_ee520df2', `"status" IN ('ACTIVE', 'INACTIVE')`),
          checkExpression(
            'erp_shifts_times_82b30b72',
            `"startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "startTime" <> "endTime"`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_work_centers',
        columns: [
          col('capacityUnit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dailyCapacity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('shiftsPerDay', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('stageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_work_centers_capacity_736e7537', '"dailyCapacity" > 0'),
          checkExpression('erp_work_centers_shifts_477ebc18', '"shiftsPerDay" BETWEEN 1 AND 3'),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_employees',
        column: col('shiftId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_batches',
        constraint: 'erp_batches_batchNumber_key',
        columns: ['batchNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_calendar_days',
        constraint: 'erp_calendar_days_date_key',
        columns: ['date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_capas',
        constraint: 'erp_capas_capaNumber_key',
        columns: ['capaNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_capas',
        constraint: 'erp_capas_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_leave_requests',
        constraint: 'erp_leave_requests_requestNumber_key',
        columns: ['requestNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_leave_requests',
        constraint: 'erp_leave_requests_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_leave_types',
        constraint: 'erp_leave_types_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_ncrs',
        constraint: 'erp_ncrs_ncrNumber_key',
        columns: ['ncrNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_ncrs',
        constraint: 'erp_ncrs_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_product_categories',
        constraint: 'erp_product_categories_name_key',
        columns: ['name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_plan_lines',
        constraint: 'erp_production_plan_lines_productionOrderId_key',
        columns: ['productionOrderId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_plan_lines',
        constraint: 'erp_production_plan_lines_planId_lineNo_key',
        columns: ['planId', 'lineNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_plans',
        constraint: 'erp_production_plans_planNumber_key',
        columns: ['planNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_production_plans',
        constraint: 'erp_production_plans_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_shifts',
        constraint: 'erp_shifts_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_work_centers',
        constraint: 'erp_work_centers_stageKey_key',
        columns: ['stageKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_batches',
        index: 'erp_batches_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_batches',
        index: 'erp_batches_productionOrderId_idx_6ada58cc',
        columns: ['productionOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_batches',
        index: 'erp_batches_purchaseReceiptId_idx_ffe25907',
        columns: ['purchaseReceiptId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_capas',
        index: 'erp_capas_ncrId_idx_e22c656f',
        columns: ['ncrId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_capas',
        index: 'erp_capas_status_dueDate_idx_ec56e113',
        columns: ['status', 'dueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_employees',
        index: 'erp_employees_shiftId_idx_fee8a58d',
        columns: ['shiftId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_leave_requests',
        index: 'erp_leave_requests_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_leave_requests',
        index: 'erp_leave_requests_employeeId_status_idx_e746ea39',
        columns: ['employeeId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_leave_requests',
        index: 'erp_leave_requests_fromDate_idx_de8be4be',
        columns: ['fromDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_leave_requests',
        index: 'erp_leave_requests_leaveTypeId_idx_810d88f1',
        columns: ['leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_ncrs',
        index: 'erp_ncrs_inspectionId_idx_8d93ea9a',
        columns: ['inspectionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_ncrs',
        index: 'erp_ncrs_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_instructions',
        index: 'erp_packing_instructions_one_active_default_203dddcf',
        columns: ['productId'],
        extras: { where: `"status" = 'ACTIVE' AND "customerId" IS NULL`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_instructions',
        index: 'erp_packing_instructions_one_active_per_customer_262f33b7',
        columns: ['productId', 'customerId'],
        extras: { where: `"status" = 'ACTIVE' AND "customerId" IS NOT NULL`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_instructions',
        index: 'erp_packing_instructions_productId_customerId_idx_155eae7f',
        columns: ['productId', 'customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_product_documents',
        index: 'erp_product_documents_productId_status_idx_285a0d76',
        columns: ['productId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_product_price_changes',
        index: 'erp_product_price_changes_productId_changedAt_idx_b623e1f9',
        columns: ['productId', 'changedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_production_plan_lines',
        index: 'erp_production_plan_lines_planId_idx_5b32079a',
        columns: ['planId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_capas',
        foreignKey: {
          name: 'erp_capas_ncrId_fkey',
          columns: ['ncrId'],
          references: { schema: 'public', table: 'erp_ncrs', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_leave_requests',
        foreignKey: {
          name: 'erp_leave_requests_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'erp_employees', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_leave_requests',
        foreignKey: {
          name: 'erp_leave_requests_leaveTypeId_fkey',
          columns: ['leaveTypeId'],
          references: { schema: 'public', table: 'erp_leave_types', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_production_plan_lines',
        foreignKey: {
          name: 'erp_production_plan_lines_planId_fkey',
          columns: ['planId'],
          references: { schema: 'public', table: 'erp_production_plans', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_employees',
        foreignKey: {
          name: 'erp_employees_shiftId_fkey',
          columns: ['shiftId'],
          references: { schema: 'public', table: 'erp_shifts', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
