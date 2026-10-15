#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/18f21701327e7468d411506fd34b155534332c720aae339e2d13f0e6eb8eb966/contract';
import endContract from '../../snapshots/18f21701327e7468d411506fd34b155534332c720aae339e2d13f0e6eb8eb966/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9acd9c9787f4d197375a61f9e6941f180d9b661fc3b773954cb0b8e08a4089cc/contract';
import startContract from '../../snapshots/9acd9c9787f4d197375a61f9e6941f180d9b661fc3b773954cb0b8e08a4089cc/contract.json' with { type: 'json' };
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
        table: 'erp_attendance_records',
        columns: [
          col('date', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('overtimeHours', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('recordedBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('remarks', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_attendance_overtime_7a045ec0',
            '"overtimeHours" >= 0 AND "overtimeHours" <= 24',
          ),
          checkExpression(
            'erp_attendance_status_89d03483',
            `"status" IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'HOLIDAY', 'WEEKLY_OFF')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_departments',
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
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('erp_departments_status_ee520df2', `"status" IN ('ACTIVE', 'INACTIVE')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_employees',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('allowances', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('bankAccount', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('basicSalary', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('departmentId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('designation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employmentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fatherName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fixedDeduction', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('joinDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leftDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nationalId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('overtimeRate', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('payBasis', 'text', {
            notNull: true,
            default: lit('MONTHLY'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
            'erp_employees_dates_aa7ed532',
            '"leftDate" IS NULL OR "leftDate" >= "joinDate"',
          ),
          checkExpression('erp_employees_pay_basis_86d9d810', `"payBasis" IN ('MONTHLY', 'DAILY')`),
          checkExpression(
            'erp_employees_pay_nonnegative_9c3ff11e',
            '"basicSalary" >= 0 AND "allowances" >= 0 AND "overtimeRate" >= 0 AND "fixedDeduction" >= 0',
          ),
          checkExpression('erp_employees_status_3cb0e4b8', `"status" IN ('ACTIVE', 'LEFT')`),
          checkExpression(
            'erp_employees_type_db41a0b7',
            `"employmentType" IN ('PERMANENT', 'CONTRACT', 'DAILY_WAGE')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_payroll_lines',
        columns: [
          col('adjustmentNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('advanceRecovery', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('allowances', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('allowancesEarned', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('basicEarned', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('basicSalary', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('employedDays', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('employeeId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('fixedDeduction', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('grossPay', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('netPay', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('otherDeduction', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('otherEarning', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('overtimeHours', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('overtimePay', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('overtimeRate', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('paidDays', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('payBasis', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('runId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('unpaidDays', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('unrecordedDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_payroll_lines_gross_7986d44f',
            '"grossPay" = "basicEarned" + "allowancesEarned" + "overtimePay" + "otherEarning"',
          ),
          checkExpression(
            'erp_payroll_lines_net_23b20380',
            '"netPay" = "grossPay" - "fixedDeduction" - "advanceRecovery" - "otherDeduction" AND "netPay" >= 0',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_payroll_runs',
        columns: [
          col('approvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('approvedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('calculatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('cancelledBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('deductionTotal', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('employeeCount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('grossTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('netTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paidAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('paymentReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('period', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('periodDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('runNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_payroll_runs_status_0c430d1c',
            `"status" IN ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')`,
          ),
          checkExpression(
            'erp_payroll_runs_total_693b5987',
            '"netTotal" = "grossTotal" - "deductionTotal"',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'erp_salary_advances',
        columns: [
          col('advanceNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('cancelledBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdBy', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('employeeId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('installment', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('issueDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recovered', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'erp_salary_advances_amounts_5be432fd',
            '"amount" > 0 AND "installment" > 0 AND "installment" <= "amount" AND "recovered" >= 0 AND "recovered" <= "amount"',
          ),
          checkExpression(
            'erp_salary_advances_status_187bacb5',
            `"status" IN ('OPEN', 'CLOSED', 'CANCELLED')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_attendance_records',
        constraint: 'erp_attendance_records_employeeId_date_key',
        columns: ['employeeId', 'date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_departments',
        constraint: 'erp_departments_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_departments',
        constraint: 'erp_departments_name_key',
        columns: ['name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_employees',
        constraint: 'erp_employees_employeeCode_key',
        columns: ['employeeCode'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_payroll_lines',
        constraint: 'erp_payroll_lines_runId_employeeId_key',
        columns: ['runId', 'employeeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_payroll_runs',
        constraint: 'erp_payroll_runs_runNumber_key',
        columns: ['runNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'erp_salary_advances',
        constraint: 'erp_salary_advances_advanceNumber_key',
        columns: ['advanceNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_attendance_records',
        index: 'erp_attendance_records_date_idx_b4ca319c',
        columns: ['date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_attendance_records',
        index: 'erp_attendance_records_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_employees',
        index: 'erp_employees_departmentId_idx_8e261ed8',
        columns: ['departmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_employees',
        index: 'erp_employees_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_payroll_lines',
        index: 'erp_payroll_lines_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_payroll_lines',
        index: 'erp_payroll_lines_runId_idx_a6016437',
        columns: ['runId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_payroll_runs',
        index: 'erp_payroll_runs_one_per_period_97c10069',
        columns: ['period'],
        extras: { where: `"status" <> 'CANCELLED'`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_salary_advances',
        index: 'erp_salary_advances_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'erp_salary_advances',
        index: 'erp_salary_advances_employeeId_status_idx_e746ea39',
        columns: ['employeeId', 'status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_attendance_records',
        foreignKey: {
          name: 'erp_attendance_records_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'erp_employees', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_employees',
        foreignKey: {
          name: 'erp_employees_departmentId_fkey',
          columns: ['departmentId'],
          references: { schema: 'public', table: 'erp_departments', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_payroll_lines',
        foreignKey: {
          name: 'erp_payroll_lines_runId_fkey',
          columns: ['runId'],
          references: { schema: 'public', table: 'erp_payroll_runs', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_payroll_lines',
        foreignKey: {
          name: 'erp_payroll_lines_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'erp_employees', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'erp_salary_advances',
        foreignKey: {
          name: 'erp_salary_advances_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'erp_employees', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
