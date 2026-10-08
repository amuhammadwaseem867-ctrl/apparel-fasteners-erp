"use client";

import { useState } from "react";
import { AlertTriangle, FileWarning } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import useQualityStore from "@/lib/useQualityStore";

export default function NCRPage() {
  const toast = useToast();

  const { ncrs, createNcr, setNcrStatus } = useQualityStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [issue, setIssue] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);

  const open = ncrs.filter((ncr) => ncr.status === "open").length;
  const underReview = ncrs.filter((ncr) => ncr.status === "under-review").length;
  const closed = ncrs.filter((ncr) => ncr.status === "closed").length;

  function handleCreate() {
    if (!issue.trim()) return;

    setSubmitting(true);

    const ncr = createNcr({ orderId, issue: issue.trim(), severity });

    setSubmitting(false);
    setCreateOpen(false);
    setOrderId("");
    setIssue("");

    toast.success({
      title: "NCR raised",
      message: `${ncr.code} created. Create a CAPA to close it out.`,
    });
  }

  const severityColor = {
    High: "#b91c1c",
    Medium: "#b45309",
    Low: "#166534",
  };

  const statusLabel = {
    open: "Open",
    "under-review": "Under review",
    closed: "Closed",
  };

  return (
    <main style={{ display: "grid", gap: "24px", padding: "24px 0" }}>
      <PageHeader
        eyebrow="Quality Control"
        title="Non-Conformance Reports"
        description="Track quality deviations and coordinate corrective actions."
        action={
          <Button
            variant="primary"
            icon={FileWarning}
            onClick={() => setCreateOpen(true)}
          >
            Raise NCR
          </Button>
        }
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Open</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{open}</strong>
        </Card>

        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Under review</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{underReview}</strong>
        </Card>

        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Closed</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{closed}</strong>
        </Card>
      </section>

      <Card title="NCR register" description="Open and active quality deviations">
        {ncrs.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            title="No NCRs"
            description="Non-conformance reports appear here when a final inspection fails or an NCR is raised manually."
            action={
              <Button
                variant="primary"
                icon={FileWarning}
                onClick={() => setCreateOpen(true)}
              >
                Raise NCR
              </Button>
            }
          />
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {ncrs.map((ncr) => (
              <div key={ncr.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 0.8fr auto", gap: "12px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Code</div>
                  <strong>{ncr.code}</strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Order</div>
                  <strong>{ncr.orderId || "—"}</strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Issue</div>
                  <strong>{ncr.issue}</strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Severity</div>
                  <strong style={{ color: severityColor[ncr.severity] }}>
                    {ncr.severity}
                  </strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: ncr.status === "open" ? "#b91c1c" : ncr.status === "under-review" ? "#b45309" : "#166534", background: ncr.status === "open" ? "#fee2e2" : ncr.status === "under-review" ? "#fef3c7" : "#dcfce7", borderRadius: "999px", padding: "6px 8px" }}>
                    <AlertTriangle size={12} />
                    {statusLabel[ncr.status]}
                  </span>

                  {ncr.status === "open" && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setNcrStatus(ncr.id, "under-review")}
                    >
                      Review
                    </Button>
                  )}

                  {ncr.status === "under-review" && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => {
                        setNcrStatus(ncr.id, "closed");
                        toast.success({
                          title: "NCR closed",
                          message: `${ncr.code} closed.`,
                        });
                      }}
                    >
                      Close
                    </Button>
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
        title="Raise NCR"
        description="Record a non-conformance for corrective action."
      >
        <div style={{ display: "grid", gap: "14px", padding: "6px 0 2px" }}>
          <Input
            label="Order / Reference"
            placeholder="e.g. order number or work order"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
          />

          <Input
            label="Issue *"
            placeholder="Describe the quality deviation"
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
          />

          <Select
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!issue.trim() || submitting}
              onClick={handleCreate}
            >
              Create NCR
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
