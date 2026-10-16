#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/324164ae048b9cc0c36c6299e393796852f4a4288f671476e9fa01b23bdd1884/contract';
import endContract from '../../snapshots/324164ae048b9cc0c36c6299e393796852f4a4288f671476e9fa01b23bdd1884/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8aeedc4fd6f3349fbed4f1cde04011c0594649daeda6416d28526f0d36218ae1/contract';
import startContract from '../../snapshots/8aeedc4fd6f3349fbed4f1cde04011c0594649daeda6416d28526f0d36218ae1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_customers',
        column: col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_customers',
        column: col('contactPerson', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_customers',
        column: col('ntn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_customers',
        column: col('strn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_production_orders',
        column: col('tapeKg', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_order_lines',
        column: col('finish', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_order_lines',
        column: col('size', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_order_lines',
        column: col('tapeColor', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_sales_orders',
        column: col('customerPo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
