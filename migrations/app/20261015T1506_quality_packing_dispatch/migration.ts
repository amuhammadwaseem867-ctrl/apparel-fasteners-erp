#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ea66a699f62ebade085627d47279f43a5cf15be632f29c4d25a7a06e3c82386b/contract';
import endContract from '../../snapshots/ea66a699f62ebade085627d47279f43a5cf15be632f29c4d25a7a06e3c82386b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fe44d181b57784cb63bc1565012cf6ece90ff2ec5d4aa39175b71ddc8e44153e/contract';
import startContract from '../../snapshots/fe44d181b57784cb63bc1565012cf6ece90ff2ec5d4aa39175b71ddc8e44153e/contract.json' with { type: 'json' };
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
        table: 'erp_packing_lists',
        columns: [
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('confirmedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('locationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('packageCount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('packingNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('productionOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('salesOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('shipmentId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalQuantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_packing_lists_status_e383a8e3',
            `"status" IN ('DRAFT', 'CONFIRMED', 'SHIPPED', 'CANCELLED')`,
          ),
          checkExpression(
            'erp_packing_lists_totals_94854e8d',
            '"totalQuantity" > 0 AND "packageCount" > 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_packing_packages',
        columns: [
          col('dimensions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('grossWeight', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('marks', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('netWeight', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('packageNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('packageType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('packingListId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_packing_packages_quantity_positive_fc510296', '"quantity" > 0'),
          checkExpression(
            'erp_packing_packages_weights_11116c74',
            '("netWeight" IS NULL OR "netWeight" >= 0) AND ("grossWeight" IS NULL OR "grossWeight" >= 0)',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_quality_inspections',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('decidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('decidedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('decisionNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('defects', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inspectedQuantity', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('inspectionNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inspectionType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inspectorName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('locationId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('passedQuantity', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('productionOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
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
          col('sampleSize', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('stageKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_quality_inspections_balance_722a9d01',
            '"inspectedQuantity" = "passedQuantity" + "reworkQuantity" + "rejectedQuantity"',
          ),
          checkExpression(
            'erp_quality_inspections_quantities_ea110972',
            '"inspectedQuantity" > 0 AND "passedQuantity" >= 0 AND "reworkQuantity" >= 0 AND "rejectedQuantity" >= 0',
          ),
          checkExpression(
            'erp_quality_inspections_status_d2448e5d',
            `"status" IN ('OPEN', 'APPROVED', 'CANCELLED')`,
          ),
          checkExpression(
            'erp_quality_inspections_type_40a4b6a4',
            `"inspectionType" IN ('INCOMING', 'IN_PROCESS', 'FINAL')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_shipment_lines',
        columns: [
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('packingListId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('salesOrderLineId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('shipmentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_shipment_lines_quantity_positive_fc510296', '"quantity" > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_shipments',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('customerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('deliveredBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('deliveryAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('deliveryNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dispatchedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('dispatchedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('driverName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('driverPhone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('locationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('receivedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('salesOrderId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('shipmentNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('trackingReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('transporter', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('vehicleNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_shipments_status_12ca9948',
            `"status" IN ('DRAFT', 'DISPATCHED', 'DELIVERED', 'CANCELLED')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_packing_lists',
        constraint: 'erp_packing_lists_packingNumber_key',
        columns: ['packingNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_packing_lists',
        constraint: 'erp_packing_lists_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_packing_packages',
        constraint: 'erp_packing_packages_packingListId_packageNo_key',
        columns: ['packingListId', 'packageNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_quality_inspections',
        constraint: 'erp_quality_inspections_inspectionNumber_key',
        columns: ['inspectionNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_quality_inspections',
        constraint: 'erp_quality_inspections_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_shipment_lines',
        constraint: 'erp_shipment_lines_shipmentId_lineNo_key',
        columns: ['shipmentId', 'lineNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_shipments',
        constraint: 'erp_shipments_shipmentNumber_key',
        columns: ['shipmentNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_shipments',
        constraint: 'erp_shipments_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_lists',
        index: 'erp_packing_lists_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_lists',
        index: 'erp_packing_lists_productionOrderId_idx_6ada58cc',
        columns: ['productionOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_lists',
        index: 'erp_packing_lists_salesOrderId_status_idx_a5b16527',
        columns: ['salesOrderId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_packing_packages',
        index: 'erp_packing_packages_packingListId_idx_0d35693a',
        columns: ['packingListId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_quality_inspections',
        index: 'erp_quality_inspections_inspectionType_status_idx_9d8de318',
        columns: ['inspectionType', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_quality_inspections',
        index: 'erp_quality_inspections_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_quality_inspections',
        index: 'erp_quality_inspections_productionOrderId_idx_6ada58cc',
        columns: ['productionOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shipment_lines',
        index: 'erp_shipment_lines_packingListId_idx_0d35693a',
        columns: ['packingListId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shipment_lines',
        index: 'erp_shipment_lines_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shipment_lines',
        index: 'erp_shipment_lines_shipmentId_idx_e3606ec1',
        columns: ['shipmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shipments',
        index: 'erp_shipments_salesOrderId_idx_0f1a116c',
        columns: ['salesOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_shipments',
        index: 'erp_shipments_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_packing_lists',
        foreignKey: {
          name: 'erp_packing_lists_productionOrderId_fkey',
          columns: ['productionOrderId'],
          references: { schema: 'public', table: 'erp_production_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_packing_lists',
        foreignKey: {
          name: 'erp_packing_lists_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_packing_packages',
        foreignKey: {
          name: 'erp_packing_packages_packingListId_fkey',
          columns: ['packingListId'],
          references: { schema: 'public', table: 'erp_packing_lists', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_quality_inspections',
        foreignKey: {
          name: 'erp_quality_inspections_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_quality_inspections',
        foreignKey: {
          name: 'erp_quality_inspections_productionOrderId_fkey',
          columns: ['productionOrderId'],
          references: { schema: 'public', table: 'erp_production_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_shipment_lines',
        foreignKey: {
          name: 'erp_shipment_lines_shipmentId_fkey',
          columns: ['shipmentId'],
          references: { schema: 'public', table: 'erp_shipments', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_shipment_lines',
        foreignKey: {
          name: 'erp_shipment_lines_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_shipments',
        foreignKey: {
          name: 'erp_shipments_salesOrderId_fkey',
          columns: ['salesOrderId'],
          references: { schema: 'public', table: 'erp_sales_orders', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
