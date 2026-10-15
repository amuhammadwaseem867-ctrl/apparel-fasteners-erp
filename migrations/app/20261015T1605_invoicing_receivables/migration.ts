#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4e61fb4318099bcdfa31b4c022febbc8c69cf67ee658f9487e2d2b191104bfe6/contract';
import endContract from '../../snapshots/4e61fb4318099bcdfa31b4c022febbc8c69cf67ee658f9487e2d2b191104bfe6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ea66a699f62ebade085627d47279f43a5cf15be632f29c4d25a7a06e3c82386b/contract';
import startContract from '../../snapshots/ea66a699f62ebade085627d47279f43a5cf15be632f29c4d25a7a06e3c82386b/contract.json' with { type: 'json' };
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
        table: 'erp_credit_note_lines',
        columns: [
          col('creditNoteId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('discountAmount', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('grossAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('invoiceLineId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('taxAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_credit_note_lines_quantity_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_credit_note_lines_total_ae91d4e0',
            '"lineTotal" = "grossAmount" - "discountAmount" + "taxAmount"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_credit_notes',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('creditDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('creditNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('customerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('discountTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subtotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('taxTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('totalAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_credit_notes_total_6e09d01c',
            '"totalAmount" > 0 AND "totalAmount" = "subtotal" - "discountTotal" + "taxTotal"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_customer_receipts',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('customerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('method', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('receiptDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('receiptNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('POSTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('voidReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('voidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('voidedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_customer_receipts_amount_positive_ed0d10ac', '"amount" > 0'),
          checkExpression(
            'erp_customer_receipts_method_582524af',
            `"method" IN ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER')`,
          ),
          checkExpression(
            'erp_customer_receipts_status_12d53be9',
            `"status" IN ('POSTED', 'VOIDED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_invoice_lines',
        columns: [
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('discountAmount', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('discountPercent', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('grossAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('invoiceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lineTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('productId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('salesOrderLineId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('taxAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('taxPercent', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unitPrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_invoice_lines_percents_01abab9f',
            '"discountPercent" BETWEEN 0 AND 100 AND "taxPercent" BETWEEN 0 AND 100',
          ),
          checkExpression(
            'erp_invoice_lines_quantity_3b6690a7',
            '"quantity" > 0 AND "unitPrice" >= 0',
          ),
          checkExpression(
            'erp_invoice_lines_total_ae91d4e0',
            '"lineTotal" = "grossAmount" - "discountAmount" + "taxAmount"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_invoices',
        columns: [
          col('cancelReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('cancelledBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('customerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('discountTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('dueDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('issuedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('issuedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('salesOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('shipmentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subtotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('taxTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('totalAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_invoices_nonnegative_1ad4ee5d',
            '"subtotal" >= 0 AND "discountTotal" >= 0 AND "taxTotal" >= 0',
          ),
          checkExpression(
            'erp_invoices_status_c484ea39',
            `"status" IN ('DRAFT', 'ISSUED', 'CANCELLED')`,
          ),
          checkExpression(
            'erp_invoices_total_afde76ef',
            '"totalAmount" = "subtotal" - "discountTotal" + "taxTotal"',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_credit_note_lines',
        constraint: 'erp_credit_note_lines_creditNoteId_invoiceLineId_key',
        columns: ['creditNoteId', 'invoiceLineId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_credit_notes',
        constraint: 'erp_credit_notes_creditNumber_key',
        columns: ['creditNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_credit_notes',
        constraint: 'erp_credit_notes_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_customer_receipts',
        constraint: 'erp_customer_receipts_receiptNumber_key',
        columns: ['receiptNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_customer_receipts',
        constraint: 'erp_customer_receipts_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_invoice_lines',
        constraint: 'erp_invoice_lines_invoiceId_lineNo_key',
        columns: ['invoiceId', 'lineNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_invoices',
        constraint: 'erp_invoices_invoiceNumber_key',
        columns: ['invoiceNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_invoices',
        constraint: 'erp_invoices_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_credit_note_lines',
        index: 'erp_credit_note_lines_creditNoteId_idx_2a875364',
        columns: ['creditNoteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_credit_note_lines',
        index: 'erp_credit_note_lines_invoiceLineId_idx_1805647d',
        columns: ['invoiceLineId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_credit_notes',
        index: 'erp_credit_notes_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_credit_notes',
        index: 'erp_credit_notes_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_customer_receipts',
        index: 'erp_customer_receipts_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_customer_receipts',
        index: 'erp_customer_receipts_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_customer_receipts',
        index: 'erp_customer_receipts_invoiceId_status_idx_7d5bfaf7',
        columns: ['invoiceId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_customer_receipts',
        index: 'erp_customer_receipts_receiptDate_idx_4c5b18d1',
        columns: ['receiptDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_invoice_lines',
        index: 'erp_invoice_lines_invoiceId_idx_d5c4f70e',
        columns: ['invoiceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_invoices',
        index: 'erp_invoices_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_invoices',
        index: 'erp_invoices_customerId_status_idx_2986b558',
        columns: ['customerId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_invoices',
        index: 'erp_invoices_dueDate_idx_fb527616',
        columns: ['dueDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_invoices',
        index: 'erp_invoices_one_per_shipment_03148691',
        columns: ['shipmentId'],
        extras: { where: `"status" <> 'CANCELLED'`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_invoices',
        index: 'erp_invoices_salesOrderId_idx_0f1a116c',
        columns: ['salesOrderId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_credit_note_lines',
        foreignKey: {
          name: 'erp_credit_note_lines_creditNoteId_fkey',
          columns: ['creditNoteId'],
          references: { schema: 'public', table: 'erp_credit_notes', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_credit_note_lines',
        foreignKey: {
          name: 'erp_credit_note_lines_invoiceLineId_fkey',
          columns: ['invoiceLineId'],
          references: { schema: 'public', table: 'erp_invoice_lines', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_credit_notes',
        foreignKey: {
          name: 'erp_credit_notes_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'erp_invoices', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_customer_receipts',
        foreignKey: {
          name: 'erp_customer_receipts_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'erp_invoices', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_invoice_lines',
        foreignKey: {
          name: 'erp_invoice_lines_invoiceId_fkey',
          columns: ['invoiceId'],
          references: { schema: 'public', table: 'erp_invoices', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_invoices',
        foreignKey: {
          name: 'erp_invoices_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'erp_customers', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_invoices',
        foreignKey: {
          name: 'erp_invoices_salesOrderId_fkey',
          columns: ['salesOrderId'],
          references: { schema: 'public', table: 'erp_sales_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
