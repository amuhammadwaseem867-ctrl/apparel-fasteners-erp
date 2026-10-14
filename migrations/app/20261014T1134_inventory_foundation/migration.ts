#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1fb3f8d5732e6a75e4561d2d3af3564ce040e31e7d935927ce4b91cceb21150a/contract';
import startContract from '../../snapshots/1fb3f8d5732e6a75e4561d2d3af3564ce040e31e7d935927ce4b91cceb21150a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/3fbf924d1bf55acea5413e769f3ccc24312ed720241f50b7b06ae98d291af9ba/contract';
import endContract from '../../snapshots/3fbf924d1bf55acea5413e769f3ccc24312ed720241f50b7b06ae98d291af9ba/contract.json' with { type: 'json' };
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
        table: 'erp_document_sequences',
        columns: [
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nextValue', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['key']),
          checkExpression('erp_document_sequences_positive_bbe83fe1', '"nextValue" >= 1'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_stock_balances',
        columns: [
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('locationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('onHand', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('qualityHold', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('reserved', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
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
            'erp_stock_balances_committed_within_on_hand_166a2f1f',
            '"reserved" + "qualityHold" <= "onHand"',
          ),
          checkExpression(
            'erp_stock_balances_nonnegative_222ff375',
            '"onHand" >= 0 AND "reserved" >= 0 AND "qualityHold" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_stock_documents',
        columns: [
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('documentNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('documentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('postedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sourceId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sourceType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('POSTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_stock_movements',
        columns: [
          col('balanceAfter', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('bucket', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('documentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('locationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('movementType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantityDelta', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('reservationId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_stock_movements_bucket_14b4945d',
            `"bucket" IN ('ON_HAND', 'RESERVED', 'QUALITY_HOLD')`,
          ),
          checkExpression('erp_stock_movements_nonzero_db56c395', '"quantityDelta" <> 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_stock_reservations',
        columns: [
          col('consumedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('locationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('releasedQuantity', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('salesOrderId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('salesOrderLineId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
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
            'erp_stock_reservations_quantities_f930339d',
            '"quantity" > 0 AND "consumedQuantity" >= 0 AND "releasedQuantity" >= 0 AND "consumedQuantity" + "releasedQuantity" <= "quantity"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_storage_locations',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('warehouseId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_warehouses',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('warehouseType', 'text', {
            notNull: true,
            default: lit('GENERAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('barcode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('color', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('finish', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('itemType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('logoType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('material', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('minimumStock', 'numeric', {
          notNull: true,
          default: lit('0'),
          codecRef: { codecId: 'pg/numeric@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_products',
        column: col('size', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'erp_products',
        constraint: 'erp_products_minimum_stock_nonnegative_99e3bb6c',
        expression: '"minimumStock" >= 0',
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_products',
        constraint: 'erp_products_barcode_key',
        columns: ['barcode'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_stock_balances',
        constraint: 'erp_stock_balances_productId_locationId_key',
        columns: ['productId', 'locationId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_stock_documents',
        constraint: 'erp_stock_documents_documentNumber_key',
        columns: ['documentNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_stock_documents',
        constraint: 'erp_stock_documents_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_stock_movements',
        constraint: 'erp_stock_movements_documentId_lineNo_bucket_key',
        columns: ['documentId', 'lineNo', 'bucket'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_storage_locations',
        constraint: 'erp_storage_locations_warehouseId_code_key',
        columns: ['warehouseId', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_warehouses',
        constraint: 'erp_warehouses_code_key',
        columns: ['code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_balances',
        index: 'erp_stock_balances_locationId_idx_7aae3038',
        columns: ['locationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_balances',
        index: 'erp_stock_balances_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_documents',
        index: 'erp_stock_documents_documentType_idx_e4b68595',
        columns: ['documentType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_documents',
        index: 'erp_stock_documents_postedAt_idx_5420e095',
        columns: ['postedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_documents',
        index: 'erp_stock_documents_sourceType_sourceId_idx_9b8c3bc3',
        columns: ['sourceType', 'sourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_movements',
        index: 'erp_stock_movements_documentId_idx_825ef746',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_movements',
        index: 'erp_stock_movements_locationId_idx_7aae3038',
        columns: ['locationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_movements',
        index: 'erp_stock_movements_movementType_idx_5c6c79d2',
        columns: ['movementType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_movements',
        index: 'erp_stock_movements_productId_createdAt_idx_58d1a09b',
        columns: ['productId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_movements',
        index: 'erp_stock_movements_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_reservations',
        index: 'erp_stock_reservations_locationId_idx_7aae3038',
        columns: ['locationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_reservations',
        index: 'erp_stock_reservations_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_reservations',
        index: 'erp_stock_reservations_salesOrderId_idx_0f1a116c',
        columns: ['salesOrderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_stock_reservations',
        index: 'erp_stock_reservations_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_storage_locations',
        index: 'erp_storage_locations_warehouseId_idx_8ff93e70',
        columns: ['warehouseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_warehouses',
        index: 'erp_warehouses_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_balances',
        foreignKey: {
          name: 'erp_stock_balances_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_balances',
        foreignKey: {
          name: 'erp_stock_balances_locationId_fkey',
          columns: ['locationId'],
          references: { schema: 'public', table: 'erp_storage_locations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_movements',
        foreignKey: {
          name: 'erp_stock_movements_documentId_fkey',
          columns: ['documentId'],
          references: { schema: 'public', table: 'erp_stock_documents', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_movements',
        foreignKey: {
          name: 'erp_stock_movements_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_movements',
        foreignKey: {
          name: 'erp_stock_movements_locationId_fkey',
          columns: ['locationId'],
          references: { schema: 'public', table: 'erp_storage_locations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_reservations',
        foreignKey: {
          name: 'erp_stock_reservations_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'erp_products', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_stock_reservations',
        foreignKey: {
          name: 'erp_stock_reservations_locationId_fkey',
          columns: ['locationId'],
          references: { schema: 'public', table: 'erp_storage_locations', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_storage_locations',
        foreignKey: {
          name: 'erp_storage_locations_warehouseId_fkey',
          columns: ['warehouseId'],
          references: { schema: 'public', table: 'erp_warehouses', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
