"use client";

import Link from "next/link";

import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function DispatchOverviewPage() {
  const ready = useApiData("/api/packing/lists?status=CONFIRMED&pageSize=100");
  const drafts = useApiData("/api/dispatch/shipments?status=DRAFT&pageSize=100");
  const transit = useApiData("/api/dispatch/shipments?status=DISPATCHED&pageSize=100");
  const count = (data, key) => (data.data ? `${data.data[key].length}${data.data.hasMore ? "+" : ""}` : "…");
  const error = ready.error || drafts.error || transit.error;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Dispatch</p>
          <h1>Dispatch &amp; Delivery</h1>
          <p>Packed goods are shipped against approved sales orders: draft, dispatch (stock out), then delivery confirmation. Partial deliveries are supported; nothing ships past the ordered quantity.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/dispatch/ready">Ready for delivery</Link>
        </div>
      </header>
      {error ? (
        <p className="inv-dialog__error" role="alert">{error}</p>
      ) : (
        <section className="inv-kpis" aria-label="Dispatch">
          <div className="inv-kpi"><span>Packed, ready to ship</span><strong>{count(ready, "packingLists")}</strong><small>packing lists</small></div>
          <div className="inv-kpi"><span>Draft shipments</span><strong>{count(drafts, "shipments")}</strong><small>to dispatch</small></div>
          <div className="inv-kpi inv-kpi--warning"><span>In transit</span><strong>{count(transit, "shipments")}</strong><small>dispatched, not yet delivered</small></div>
        </section>
      )}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Dispatch areas</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li><Link href="/dispatch/ready">Ready for delivery</Link>: packed lists by sales order.</li>
          <li><Link href="/dispatch/dispatch">Dispatch</Link>: draft shipments to dispatch.</li>
          <li><Link href="/dispatch/shipments">Shipments</Link>: all shipments and delivery challans.</li>
          <li><Link href="/dispatch/delivered">Delivered</Link>: confirmed deliveries.</li>
        </ul>
      </section>
    </main>
  );
}
