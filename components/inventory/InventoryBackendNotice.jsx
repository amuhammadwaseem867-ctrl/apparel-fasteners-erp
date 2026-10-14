"use client";

import Alert from "@/components/ui/Alert";

/*
 * Shown on inventory pages while there is no inventory API.
 *
 * The application has no /api/inventory routes and the database contract
 * (src/prisma/contract.json) has no warehouse, location, stock balance,
 * movement, goods receipt, transfer, adjustment, batch or stock count
 * tables. Actions that would create or change inventory records are
 * disabled so nothing is presented as saved when it is not.
 */

export const INVENTORY_BACKEND_UNAVAILABLE =
  "Not available yet: the inventory database schema and API have not been set up.";

export default function InventoryBackendNotice({ className = "" }) {
  return (
    <Alert
      variant="warning"
      title="Inventory backend not available"
      className={className}
    >
      Inventory records cannot be loaded or saved yet. The server has no
      inventory API, and the database has no tables for warehouses, stock
      balances, movements, receipts, transfers or adjustments. Actions that
      would change stock are disabled. An administrator needs to add the
      inventory schema and apply its database migration before these
      features can be used.
    </Alert>
  );
}
