#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/17c4c0b0a08e9da95d131af9c8b779f84417a554283c8216304be5fa0b5a0a66/contract';
import endContract from '../../snapshots/17c4c0b0a08e9da95d131af9c8b779f84417a554283c8216304be5fa0b5a0a66/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/63b8adaa61138d574f1d356629f20a93def2ce14aead7b56cf760df11b112ea1/contract';
import startContract from '../../snapshots/63b8adaa61138d574f1d356629f20a93def2ce14aead7b56cf760df11b112ea1/contract.json' with { type: 'json' };
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
        table: 'erp_customer_ledger_entries',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credit', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('customerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('dateMissing', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('dcNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('debit', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entryDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('poNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_customer_ledger_entries_amounts_bd2d3c51',
            '"debit" >= 0 AND "credit" >= 0',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_customer_ledger_entries',
        constraint: 'erp_customer_ledger_entries_customerId_lineNo_key',
        columns: ['customerId', 'lineNo'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_customer_ledger_entries',
        index: 'erp_customer_ledger_entries_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_customer_ledger_entries',
        index: 'erp_customer_ledger_entries_entryDate_idx_f5afac2f',
        columns: ['entryDate'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_customer_ledger_entries',
        foreignKey: {
          name: 'erp_customer_ledger_entries_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'erp_customers', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
