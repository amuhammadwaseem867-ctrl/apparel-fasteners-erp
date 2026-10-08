"use client";

import { useState } from "react";
import { CheckCircle2, FileCheck2, PackageCheck } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";

import useQualityStore from "@/lib/useQualityStore";

/*
 * Final Inspection — the last quality gate before packing
 * and dispatch release.
 */

export default function FinalInspectionPage() {
  const toast = useToast();

  const { inspections, createInspection, setResult } = useQualityStore();

  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseOrder, setReleaseOrder] = useState("");
  const [releaseQty, setReleaseQty] = useState("");
  const [releaseRemarks, setReleaseRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const approved = inspections.filter(
    (inspection) =>
      inspection.type === "final" && inspection.result === "approved"
  ).length;

  const conditional = inspections.filter(
    (inspection) =>
      inspection.type === "final" && inspection.result === "conditional"
  ).length;

  const failed = inspections.filter(
    (inspection) =>
      inspection.type === "final" && inspection.result === "rejected"
  ).length;

  function handleRelease() {
    if (!releaseOrder.trim() || !releaseQty) return;

    setSubmitting(true);

    createInspection({
      type: "final",
      orderId: releaseOrder.trim(),
      quantity: releaseQty,
      result: "approved",
      remarks: releaseRemarks,
    });

    setSubmitting(false);
    setReleaseOpen(false);
    setReleaseOrder("");
    setReleaseQty("");
    setReleaseRemarks("");

    toast.success({
      title: "Release completed",
      message: "Final inspection approved. Order is eligible for packing.",
    });
  }

  const finalChecks = inspections.filter(
    (inspection) => inspection.type === "final"
  );

  return (
    <main style={{ display: "grid", gap: "24px", padding: "24px 0" }}>
      <PageHeader
        eyebrow="Quality Control"
        title="Final Inspection"
        description="Conclude inspection before packing and dispatch release."
        action={
          <Button
            variant="primary"
            icon={PackageCheck}
            onClick={() => setReleaseOpen(true)}
          >
            Complete release
          </Button>
        }
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Approved</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{approved}</strong>
        </Card>

        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Conditional</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{conditional}</strong>
        </Card>

        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Failed</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{failed}</strong>
        </Card>
      </section>

      <Card title="Final inspection register" description="Approved or failed orders awaiting dispatch release">
        <div style={{ display: "grid", gap: "12px" }}>
          {finalChecks.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#667085", fontSize: "12px" }}>
              No final inspections recorded yet. Complete a release
              above or run inspections from the Inspections page.
            </div>
          ) : (
            finalChecks.map((check) => (
              <div key={check.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.8fr auto", gap: "12px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Order</div>
                  <strong>{check.orderId}</strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Inspector</div>
                  <strong>{check.inspector}</strong>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Qty</div>
                  <strong>{check.quantity}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: check.result === "approved" ? "#166534" : check.result === "conditional" ? "#b45309" : "#b91c1c", background: check.result === "approved" ? "#dcfce7" : check.result === "conditional" ? "#fef3c7" : "#fee2e2", borderRadius: "999px", padding: "6px 8px" }}>
                    {check.result === "approved" ? <CheckCircle2 size={12} /> : <FileCheck2 size={12} />}
                    {check.result}
                  </span>

                  {check.result === "pending" && (
                    <>
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => setResult(check.id, "approved", "")}
                      >
                        Approve
                      </Button>

                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setResult(check.id, "rejected", "")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        title="Complete Final Release"
        description="Approve an order for packing after final inspection."
      >
        <div style={{ display: "grid", gap: "14px", padding: "6px 0 2px" }}>
          <Input
            label="Order Number / Reference *"
            placeholder="e.g. order number"
            value={releaseOrder}
            onChange={(event) => setReleaseOrder(event.target.value)}
          />

          <Input
            label="Approved Quantity *"
            type="number"
            min="0"
            value={releaseQty}
            onChange={(event) => setReleaseQty(event.target.value)}
          />

          <Input
            label="Remarks"
            value={releaseRemarks}
            onChange={(event) => setReleaseRemarks(event.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="secondary" onClick={() => setReleaseOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!releaseOrder.trim() || !releaseQty || submitting}
              onClick={handleRelease}
            >
              Approve &amp; Release
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
