"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Plus, ShieldAlert, PackageCheck } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import useQualityStore from "@/lib/useQualityStore";

import { PRODUCTION_STAGES } from "@/config/production";

/*
 * InspectionList — shared, working inspection list used by
 * Incoming, In-Process and Rejections pages. Supports real
 * create / approve / reject / conditional actions and filters.
 */

const RESULT_META = {
  pending: { label: "Pending", color: "#667085", bg: "#f1f3f5", icon: ClipboardCheck },
  approved: { label: "Approved", color: "#166534", bg: "#dcfce7", icon: PackageCheck },
  conditional: { label: "Conditional", color: "#b45309", bg: "#fef3c7", icon: ClipboardCheck },
  rejected: { label: "Rejected", color: "#b91c1c", bg: "#fee2e2", icon: ShieldAlert },
};

export default function InspectionList({
  type,
  title,
  description,
  emptyTitle,
  emptyDescription,
  showRejectionsOnly = false,
}) {
  const toast = useToast();

  const { inspections, createInspection, setResult } = useQualityStore();

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    orderId: "",
    product: "",
    quantity: "",
    stage: "tape-dyeing",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const source = inspections.filter((inspection) =>
    showRejectionsOnly
      ? inspection.type === type && inspection.result === "rejected"
      : inspection.type === type
  );

  const filtered = useMemo(() => {
    return source.filter((inspection) => {
      if (resultFilter !== "all" && inspection.result !== resultFilter) return false;

      if (search.trim()) {
        const value = search.trim().toLowerCase();

        const searchable = [
          inspection.id,
          inspection.orderId,
          inspection.product,
          inspection.inspector,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(value)) return false;
      }

      return true;
    });
  }, [source, search, resultFilter]);

  const counts = {
    pending: source.filter((i) => i.result === "pending").length,
    approved: source.filter((i) => i.result === "approved").length,
    conditional: source.filter((i) => i.result === "conditional").length,
    rejected: source.filter((i) => i.result === "rejected").length,
  };

  function handleCreate() {
    if (!form.product.trim()) return;

    setSubmitting(true);

    const inspection = createInspection({ ...form, type });

    setSubmitting(false);
    setCreateOpen(false);
    setForm({ orderId: "", product: "", quantity: "", stage: "tape-dyeing", remarks: "" });

    toast.success({
      title: "Inspection created",
      message: `Inspection for ${inspection.product || "item"} created.`,
    });
  }

  return (
    <main style={{ display: "grid", gap: "24px", padding: "24px 0" }}>
      <PageHeaderActions
        title={title}
        description={description}
        onCreate={() => setCreateOpen(true)}
        onReset={() => {
          setSearch("");
          setResultFilter("all");
        }}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px" }}>
        {["pending", "approved", "conditional", "rejected"].map((key) => {
          const meta = RESULT_META[key];

          return (
            <Card compact key={key}>
              <div style={{ fontSize: "12px", color: "#667085" }}>{meta.label}</div>
              <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>
                {counts[key]}
              </strong>
            </Card>
          );
        })}
      </section>

      <Card title="Filters" description="Search and filter inspections">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <Input
            label="Search"
            placeholder="ID, order, product, inspector..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Select
            label="Result"
            value={resultFilter}
            onChange={setResultFilter}
            options={[
              { value: "all", label: "All Results" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "conditional", label: "Conditional" },
              { value: "rejected", label: "Rejected" },
            ]}
          />

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setResultFilter("all");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Inspection records" description={emptyDescription}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={RESULT_META.pending.icon}
            title={source.length === 0 ? emptyTitle : "No matching inspections"}
            description={
              source.length === 0
                ? emptyDescription
                : "No inspections match the current filters."
            }
            action={
              source.length === 0 ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                  New Inspection
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setResultFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )
            }
          />
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filtered.map((inspection) => {
              const meta = RESULT_META[inspection.result] || RESULT_META.pending;
              const MetaIcon = meta.icon;

              return (
                <div key={inspection.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.7fr 0.7fr auto", gap: "12px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "#667085" }}>Product</div>
                    <strong>{inspection.product || "—"}</strong>
                  </div>

                  <div>
                    <div style={{ fontSize: "12px", color: "#667085" }}>Order</div>
                    <strong>{inspection.orderId || "—"}</strong>
                  </div>

                  <div>
                    <div style={{ fontSize: "12px", color: "#667085" }}>Qty</div>
                    <strong>{inspection.quantity || "—"}</strong>
                  </div>

                  <div>
                    <div style={{ fontSize: "12px", color: "#667085" }}>Inspector</div>
                    <strong>{inspection.inspector}</strong>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: meta.color, background: meta.bg, borderRadius: "999px", padding: "6px 8px" }}>
                      <MetaIcon size={12} />
                      {meta.label}
                    </span>

                    {inspection.result === "pending" && (
                      <>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => setResult(inspection.id, "approved", "")}
                        >
                          Approve
                        </Button>

                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => setResult(inspection.id, "conditional", "")}
                        >
                          Conditional
                        </Button>

                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => setResult(inspection.id, "rejected", "")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Inspection"
        description="Create a quality inspection record."
      >
        <div style={{ display: "grid", gap: "14px", padding: "6px 0 2px" }}>
          <Input
            label="Order / Reference"
            placeholder="e.g. order number"
            value={form.orderId}
            onChange={(event) => setForm((f) => ({ ...f, orderId: event.target.value }))}
          />

          <Input
            label="Product *"
            placeholder="e.g. Teeth #5 Brass"
            value={form.product}
            onChange={(event) => setForm((f) => ({ ...f, product: event.target.value }))}
          />

          <Input
            label="Quantity"
            type="number"
            min="0"
            value={form.quantity}
            onChange={(event) => setForm((f) => ({ ...f, quantity: event.target.value }))}
          />

          <Select
            label="Production Stage"
            value={form.stage}
            onChange={(value) => setForm((f) => ({ ...f, stage: value }))}
            options={PRODUCTION_STAGES.map((stage) => ({
              value: stage.key,
              label: stage.label,
            }))}
          />

          <Input
            label="Remarks"
            value={form.remarks}
            onChange={(event) => setForm((f) => ({ ...f, remarks: event.target.value }))}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!form.product.trim() || submitting}
              onClick={handleCreate}
            >
              Create Inspection
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function PageHeaderActions({ title, description, onCreate, onReset }) {
  return (
    <PageHeader
      eyebrow="Quality Control"
      title={title}
      description={description}
      action={
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" onClick={onReset}>
            Reset
          </Button>

          <Button variant="primary" icon={Plus} onClick={onCreate}>
            New Inspection
          </Button>
        </div>
      }
    />
  );
}
