#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/09a6210e3ab8fa953347f8644d35725ff96b4bf7fde3fea3fa9c9ecac4112343/contract';
import startContract from '../../snapshots/09a6210e3ab8fa953347f8644d35725ff96b4bf7fde3fea3fa9c9ecac4112343/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/63b8adaa61138d574f1d356629f20a93def2ce14aead7b56cf760df11b112ea1/contract';
import endContract from '../../snapshots/63b8adaa61138d574f1d356629f20a93def2ce14aead7b56cf760df11b112ea1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'erp_customers',
        column: col('openingBalance', 'numeric', {
          notNull: true,
          default: lit('0'),
          codecRef: { codecId: 'pg/numeric@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'erp_customers',
        column: col('openingBalanceDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'erp_customer_receipts', column: 'invoiceId' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
