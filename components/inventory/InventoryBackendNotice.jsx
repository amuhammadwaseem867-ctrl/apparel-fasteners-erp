"use client";

import Alert from "@/components/ui/Alert";

/*
 * Shown on inventory pages whose feature has no database support yet.
 * Inventory itself is connected (warehouses, ledger, balances,
 * reservations); this now covers batch / lot tracking only.
 */

export const INVENTORY_BACKEND_UNAVAILABLE =
  "Not available yet: batch and lot tracking is not part of the inventory database schema.";

export default function InventoryBackendNotice({ className = "" }) {
  return (
    <Alert
      variant="warning"
      title="Batch and lot tracking not available yet"
      className={className}
    >
      Stock is tracked per item and storage location, but not per batch or
      lot. Recording batches needs batch tables and a database migration,
      which have not been added. Actions that would create batches are
      disabled. Use the Stock and Movements pages for current stock and its
      full history.
    </Alert>
  );
}
