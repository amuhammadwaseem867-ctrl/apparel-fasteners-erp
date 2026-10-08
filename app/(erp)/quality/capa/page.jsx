"use client";

import { useState } from "react";
import { Activity, ClipboardList, RefreshCcw } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import useQualityStore from "@/lib/useQualityStore";

export default function CAPAPage() {
  const toast = useToast();

  const { capas, createCapa, setCapaStatus } = useQualityStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [ncrRef, setNcrRef] = useState("");
  const [action, setAction] = useState("");
  const [owner, setOwner] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = capas.filter((capa) => capa.status === "open").length;
  const inProgress = capas.filter((capa) => capa.status === "in-progress").length;
  const closed = capas.filter((capa) => capa.status === "closed").length;

  function handleCreate() {
    if (!action.trim()) return;

    setSubmitting(true);

    const capa = createCapa({
      ncrId: ncrRef.trim(),
      action: action.trim(),
      owner: owner.trim(),
    });

    setSubmitting(false);
    setCreateOpen(false);
    setNcrRef("");
    setAction("");
    setOwner("");

    toast.success({
      title: "CAPA created",
      message: `${capa.code} created.`,
    });
  }

  const statusLabel = {
    open: "Open",
    "in-progress": "In progress",
    closed: "Closed",
  };

  return (
    <main style={{ display: "grid", gap: "24px", padding: "24px 0" }}>
      <PageHeader
        eyebrow="Quality Control"
        title="Corrective and Preventive Action"
        description="Follow through on quality corrective actions to prevent recurrence."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant="secondary"
              icon={RefreshCcw}
              onClick={() =>
                toast.info({
                  title: "Refreshed",
                  message: "CAPA list refreshed.",
                })
              }
            >
              Refresh actions
            </Button>

            <Button
              variant="primary"
              icon={ClipboardList}
              onClick={() => setCreateOpen(true)}
            >
              Create CAPA
            </Button>
          </div>
        }
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Open</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{open}</strong>
        </Card>

        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>In progress</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{inProgress}</strong>
        </Card>

        <Card compact>
          <div style={{ fontSize: "12px", color: "#667085" }}>Closed</div>
          <strong style={{ fontSize: "28px", display: "block", marginTop: "8px" }}>{closed}</strong>
        </Card>
      </section>

      <Card title="Action log" description="Current corrective and preventive activities">
        {capas.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No CAPA records"
            description="Corrective and preventive actions appear here once created, typically linked to an NCR."
            action={
              <Button
                variant="primary"
                icon={ClipboardList}
                onClick={() => setCreateOpen(true)}
              >
                Create CAPA
              </Button>
            }
          />
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {capas.map((capa) => (
              <div key={capa.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr auto", gap: "12px", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Code</div>
                  <strong>{capa.code}</strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Action</div>
                  <strong>{capa.action}</strong>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#667085" }}>Owner</div>
                  <strong>{capa.owner || "—"}</strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: capa.status === "open" ? "#b91c1c" : capa.status === "in-progress" ? "#1d4ed8" : "#166534", background: capa.status === "open" ? "#fee2e2" : capa.status === "in-progress" ? "#dbeafe" : "#dcfce7", borderRadius: "999px", padding: "6px 8px" }}>
                    <Activity size={12} />
                    {statusLabel[capa.status]}
                  </span>

                  {capa.status === "open" && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setCapaStatus(capa.id, "in-progress")}
                    >
                      Start
                    </Button>
                  )}

                  {capa.status === "in-progress" && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => {
                        setCapaStatus(capa.id, "closed");
                        toast.success({
                          title: "CAPA closed",
                          message: `${capa.code} closed.`,
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

      <Card title="CAPA workflow" description="Root cause -> corrective action -> verification">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
          {["Issue identified", "Root cause", "Corrective action", "Prevention", "Verification"].map((item, idx) => (
            <div key={item} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", background: "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Activity size={14} />
                <strong style={{ fontSize: "14px" }}>{idx + 1}. {item}</strong>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create CAPA"
        description="Define a corrective or preventive action."
      >
        <div style={{ display: "grid", gap: "14px", padding: "6px 0 2px" }}>
          <Input
            label="Linked NCR (optional)"
            placeholder="e.g. NCR-2041"
            value={ncrRef}
            onChange={(event) => setNcrRef(event.target.value)}
          />

          <Input
            label="Action *"
            placeholder="Describe the corrective or preventive action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          />

          <Input
            label="Owner"
            placeholder="Responsible person / department"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!action.trim() || submitting}
              onClick={handleCreate}
            >
              Create CAPA
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
