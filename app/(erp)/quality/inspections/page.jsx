"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, SearchCheck, Plus } from "lucide-react";

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

const INSPECTION_TYPES = [
  { value: "incoming", label: "Incoming" },
  { value: "in-process", label: "In-Process" },
  { value: "final", label: "Final" },
];

export default function InspectionsPage() {
  const toast = useToast();

  const { inspections, createInspection, setResult } = useQualityStore();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    type: "incoming",
    orderId: "",
    product: "",
    quantity: "",
    stage: "tape-dyeing",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    return inspections.filter((inspection) => {
      if (typeFilter !== "all" && inspection.type !== typeFilter) return false;
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
  }, [inspections, search, typeFilter, resultFilter]);

  const resultLabel = {
    pending: "Pending",
    approved: "Approved",
    conditional: "Conditional",
    rejected: "Rejected",
  };

  function handleCreate() {
    if (!form.product.trim()) return;

    setSubmitting(true);

    const inspection = createInspection(form);

    setSubmitting(false);
    setCreateOpen(false);
    setForm({
      type: "incoming",
      orderId: "",
      product: "",
      quantity: "",
      stage: "tape-dyeing",
      remarks: "",
    });

    toast.success({
      title: "Inspection created",
      message: `Inspection for ${inspection.product} is pending a result.`,
    });
  }

  return (
    <main style={{ display: "grid", gap: "24px", padding: "24px 0" }}>
      <PageHeader
        eyebrow="Quality Control"
        title="Inspection Register"
        description="Create inspections and record outcomes: approved, conditional or rejected."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant="secondary"
              icon={SearchCheck}
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
                setResultFilter("all");
              }}
            >
              Reset
            </Button>

            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setCreateOpen(true)}
            >
              New Inspection
            </Button>
          </div>
        }
      />

      <Card title="Filters" description="Search and filter the inspection register">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <Input
            label="Search"
            placeholder="ID, order, product, inspector..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Select
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: "All Types" },
              ...INSPECTION_TYPES,
            ]}
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
        </div>
      </Card>

      <Card title="Inspection activity" description="Latest passed, conditional and rejected checks">
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={
              inspections.length === 0
                ? "No inspections yet"
                : "No matching inspections"
            }
            description={
              inspections.length === 0
                ? "Create the first inspection. QC references orders, work orders, production stages, batches and products."
                : "No inspections match the current filters."
            }
            action={
              inspections.length === 0 ? (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setCreateOpen(true)}
                >
                  New Inspection
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
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
            {filtered.map((inspection) => (
              <div key={inspection.id} style={{ display: "grid", gridTemplateColumns: "0.9fr 0.7fr 1.3fr 0.8fr 0.7fr auto", gap: "12px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Type</div>
                  <strong style={{ textTransform: "capitalize" }}>
                    {inspection.type}
                  </strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Order</div>
                  <strong>{inspection.orderId || "—"}</strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Product</div>
                  <strong>{inspection.product || "—"}</strong>
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
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: inspection.result === "approved" ? "#166534" : inspection.result === "conditional" ? "#b45309" : inspection.result === "rejected" ? "#b91c1c" : "#667085", background: inspection.result === "approved" ? "#dcfce7" : inspection.result === "conditional" ? "#fef3c7" : inspection.result === "rejected" ? "#fee2e2" : "#f1f3f5", borderRadius: "999px", padding: "6px 8px" }}>
                    <ClipboardCheck size={12} />
                    {resultLabel[inspection.result]}
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
            ))}
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
          <Select
            label="Inspection Type"
            value={form.type}
            onChange={(value) => setForm((f) => ({ ...f, type: value }))}
            options={INSPECTION_TYPES}
          />

          <Input
            label="Order / Reference"
            placeholder="e.g. order number"
            value={form.orderId}
            onChange={(event) =>
              setForm((f) => ({ ...f, orderId: event.target.value }))
            }
          />

          <Input
            label="Product *"
            placeholder="e.g. Teeth #5 Brass"
            value={form.product}
            onChange={(event) =>
              setForm((f) => ({ ...f, product: event.target.value }))
            }
          />

          <Input
            label="Quantity"
            type="number"
            min="0"
            value={form.quantity}
            onChange={(event) =>
              setForm((f) => ({ ...f, quantity: event.target.value }))
            }
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
            onChange={(event) =>
              setForm((f) => ({ ...f, remarks: event.target.value }))
            }
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
