#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/17c4c0b0a08e9da95d131af9c8b779f84417a554283c8216304be5fa0b5a0a66/contract';
import startContract from '../../snapshots/17c4c0b0a08e9da95d131af9c8b779f84417a554283c8216304be5fa0b5a0a66/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5ababcdcc5b7e1ec46d27c32405512b310fd1f95bd4d217c2335d48b01b5c25c/contract';
import endContract from '../../snapshots/5ababcdcc5b7e1ec46d27c32405512b310fd1f95bd4d217c2335d48b01b5c25c/contract.json' with { type: 'json' };
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
        table: 'erp_costing_records',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('customerName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('data', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('documentDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('materialCost', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('notCostedRevenue', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('pieces', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('profit', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('recordNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('revenue', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_costing_records_source_f0c0ccad',
            `"source" IN ('QUICK', 'INVOICE')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_costing_records',
        constraint: 'erp_costing_records_recordNumber_key',
        columns: ['recordNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_costing_records',
        index: 'erp_costing_records_customerName_idx_cd210f87',
        columns: ['customerName'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_costing_records',
        index: 'erp_costing_records_documentDate_idx_10f15229',
        columns: ['documentDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_costing_records',
        index: 'erp_costing_records_one_per_invoice_e3c33e5b',
        columns: ['source', 'reference'],
        extras: { where: `"source" = 'INVOICE'`, unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
