#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0384763eb0940887c2363fe1cf81b0ce97c46ab12ee7774ec4bc34b4d2a325de/contract';
import endContract from '../../snapshots/0384763eb0940887c2363fe1cf81b0ce97c46ab12ee7774ec4bc34b4d2a325de/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/543d095a5fb9dc589fb26b9c71a2e0d3aca0a34b363f0d45774d14797cf81f32/contract';
import startContract from '../../snapshots/543d095a5fb9dc589fb26b9c71a2e0d3aca0a34b363f0d45774d14797cf81f32/contract.json' with { type: 'json' };
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
        table: 'erp_cash_transactions',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('cashAccountId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('counterAccountId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('journalEntryId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payee', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('POSTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('transactionDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('transactionNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('voidReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('voidedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('voidedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_cash_transactions_accounts_62d4335e',
            '"cashAccountId" <> "counterAccountId"',
          ),
          checkExpression(
            'erp_cash_transactions_amount_356342cb',
            '"amount" > 0 AND "amount" = round("amount", 2)',
          ),
          checkExpression(
            'erp_cash_transactions_kind_402a1b57',
            `"kind" IN ('EXPENSE', 'INCOME', 'TRANSFER')`,
          ),
          checkExpression(
            'erp_cash_transactions_status_12d53be9',
            `"status" IN ('POSTED', 'VOIDED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_journal_entries',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entryDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entryNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reversesEntryId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('sourceEvent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sourceId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('sourceType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('POSTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_journal_entries_status_84d18ad9',
            `"status" IN ('POSTED', 'REVERSED')`,
          ),
          checkExpression('erp_journal_entries_total_043493e1', '"totalAmount" > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_journal_lines',
        columns: [
          col('accountId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('credit', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('debit', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('entryId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lineNo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('memo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_journal_lines_cents_bdbd75ce',
            '"debit" = round("debit", 2) AND "credit" = round("credit", 2)',
          ),
          checkExpression(
            'erp_journal_lines_one_side_05950dd8',
            '"debit" >= 0 AND "credit" >= 0 AND ("debit" = 0) <> ("credit" = 0)',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_ledger_accounts',
        columns: [
          col('accountType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('isCashBank', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('systemKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_ledger_accounts_cash_is_asset_756458e9',
            `NOT "isCashBank" OR "accountType" = 'ASSET'`,
          ),
          checkExpression(
            'erp_ledger_accounts_status_ee520df2',
            `"status" IN ('ACTIVE', 'INACTIVE')`,
          ),
          checkExpression(
            'erp_ledger_accounts_type_ab027f61',
            `"accountType" IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_cash_transactions',
        constraint: 'erp_cash_transactions_transactionNumber_key',
        columns: ['transactionNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_cash_transactions',
        constraint: 'erp_cash_transactions_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_journal_entries',
        constraint: 'erp_journal_entries_entryNumber_key',
        columns: ['entryNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_journal_entries',
        constraint: 'erp_journal_entries_reversesEntryId_key',
        columns: ['reversesEntryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_journal_entries',
        constraint: 'erp_journal_entries_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_journal_lines',
        constraint: 'erp_journal_lines_entryId_lineNo_key',
        columns: ['entryId', 'lineNo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_ledger_accounts',
        constraint: 'erp_ledger_accounts_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_ledger_accounts',
        constraint: 'erp_ledger_accounts_systemKey_key',
        columns: ['systemKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_cash_transactions',
        index: 'erp_cash_transactions_kind_transactionDate_idx_ee6642d6',
        columns: ['kind', 'transactionDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_journal_entries',
        index: 'erp_journal_entries_entryDate_idx_f5afac2f',
        columns: ['entryDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_journal_entries',
        index: 'erp_journal_entries_one_per_source_event_c67a67e7',
        columns: ['sourceType', 'sourceId', 'sourceEvent'],
        extras: { where: '"sourceType" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_journal_entries',
        index: 'erp_journal_entries_sourceType_sourceId_idx_9b8c3bc3',
        columns: ['sourceType', 'sourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_journal_lines',
        index: 'erp_journal_lines_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_journal_lines',
        index: 'erp_journal_lines_entryId_idx_8b42d1db',
        columns: ['entryId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_journal_lines',
        foreignKey: {
          name: 'erp_journal_lines_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'erp_journal_entries', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_journal_lines',
        foreignKey: {
          name: 'erp_journal_lines_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'erp_ledger_accounts', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
