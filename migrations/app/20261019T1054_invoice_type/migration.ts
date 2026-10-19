#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3ab6ea3e77f8b90d2533e3ee42cb4c88ee3aa06fedb1740aed6431289f03eed6/contract';
import endContract from '../../snapshots/3ab6ea3e77f8b90d2533e3ee42cb4c88ee3aa06fedb1740aed6431289f03eed6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/939c3cc63fb943ed04b1ef8cccf531d06faa371d440c9d678f7a94330a2ee516/contract';
import startContract from '../../snapshots/939c3cc63fb943ed04b1ef8cccf531d06faa371d440c9d678f7a94330a2ee516/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_invoices',
        column: col('invoiceType', 'text', {
          notNull: true,
          default: lit('SALES_TAX'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'erp_invoices',
        constraint: 'erp_invoices_type_d58cf5dc',
        expression: `"invoiceType" IN ('SALES_TAX', 'NON_TAX')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
