"use client";

import Link from "next/link";

import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function PackingOverviewPage() {
  const drafts = useApiData("/api/packing/lists?status=DRAFT&pageSize=100");
  const ready = useApiData("/api/packing/lists?status=CONFIRMED&pageSize=100");
  const count = (data) => (data.data ? `${data.data.packingLists.length}${data.data.hasMore ? "+" : ""}` : "…");
  const error = drafts.error || ready.error;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Packing</p>
          <h1>Packing</h1>
          <p>Packing is stage 8 of production. A confirmed packing list records the stage and puts the packed goods into finished-goods stock, ready for dispatch.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/packing/orders">Packing lists</Link>
        </div>
      </header>
      {error ? (
        <p className="inv-dialog__error" role="alert">{error}</p>
      ) : (
        <section className="inv-kpis" aria-label="Packing">
          <div className="inv-kpi"><span>Draft packing lists</span><strong>{count(drafts)}</strong><small>awaiting confirmation</small></div>
          <div className="inv-kpi"><span>Packed, ready to ship</span><strong>{count(ready)}</strong><small>confirmed, not yet dispatched</small></div>
        </section>
      )}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Packing areas</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li><Link href="/packing/orders">Packing lists</Link>: create, confirm and print packing lists.</li>
          <li><Link href="/packing/completed">Packed &amp; shipped</Link>: confirmed and shipped lists.</li>
          <li><Link href="/dispatch/ready">Ready to dispatch</Link>: ship confirmed lists to customers.</li>
          <li>Packing instructions: not implemented yet.</li>
        </ul>
      </section>
    </main>
  );
}
