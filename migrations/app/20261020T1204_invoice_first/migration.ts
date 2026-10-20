#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2cf92c9acbd13c522550ad6f34e3d43ef7625863dcf10fc56c82c03111576914/contract';
import startContract from '../../snapshots/2cf92c9acbd13c522550ad6f34e3d43ef7625863dcf10fc56c82c03111576914/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/2dc5f2f81570adbedc3799970d313ff7a22720387a95ce83b02eb9f1ac192918/contract';
import endContract from '../../snapshots/2dc5f2f81570adbedc3799970d313ff7a22720387a95ce83b02eb9f1ac192918/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropNotNull({ schema: 'public', table: 'erp_invoices', column: 'shipmentId' })];
  }
}

MigrationCLI.run(import.meta.url, M);
