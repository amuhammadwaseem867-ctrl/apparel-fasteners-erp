"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, FlaskConical, ShieldCheck } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const stats = [
  { label: "Incoming Inspections", value: "14", icon: ClipboardCheck, trend: "+2" },
  { label: "In-Process Checks", value: "21", icon: FlaskConical, trend: "+4" },
  { label: "Approved Output", value: "96.4%", icon: CheckCircle2, trend: "+1.1%" },
  { label: "Open NCRs", value: "03", icon: AlertTriangle, trend: "-1" },
];

const workflow = [
  "Goods Receipt",
  "Incoming Inspection",
  "Approved / Rejected / Conditional",
  "Production",
  "In-Process Inspection",
  "Production Output",
  "Final Inspection",
  "Approved or NCR / CAPA",
];

export default function QualityPage() {
  return (
    <main style={{ display: "grid", gap: "24px", padding: "24px 0" }}>
      <PageHeader
        eyebrow="Quality Control"
        title="Quality Dashboard"
        description="Track incoming material quality, in-process checks, final approvals, defects and corrective actions across production."
        action={<Button variant="secondary">Export report</Button>}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        {stats.map(({ label, value, icon: Icon, trend }) => (
          <Card key={label} compact>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#667085", marginBottom: "4px" }}>{label}</div>
                <strong style={{ fontSize: "28px", color: "#111827" }}>{value}</strong>
              </div>
              <div style={{ display: "inline-flex", width: "36px", height: "36px", borderRadius: "10px", background: "#f3f4f6", alignItems: "center", justifyContent: "center", color: "#1f2937" }}>
                <Icon size={16} strokeWidth={1.8} />
              </div>
            </div>
            <div style={{ marginTop: "10px", color: "#0f766e", fontSize: "12px", fontWeight: 700 }}>{trend}</div>
          </Card>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px" }}>
        <Card title="Inspection workflow" description="Order-to-quality progression">
          <div style={{ display: "grid", gap: "12px" }}>
            {workflow.map((step, index) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: index === workflow.length - 1 ? "#dcfce7" : "#dbeafe", color: index === workflow.length - 1 ? "#166534" : "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>
                  {index + 1}
                </div>
                <div style={{ fontSize: "14px", color: "#334155" }}>{step}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quality status" description="Current action required">
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px" }}>
              <span>Approved this week</span>
              <strong>87</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px" }}>
              <span>Need re-inspection</span>
              <strong>04</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px" }}>
              <span>Open CAPA</span>
              <strong>02</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px" }}>
              <span>Final approvals pending</span>
              <strong>06</strong>
            </div>
          </div>
        </Card>
      </section>

      <Card title="Quality control modules" description="Module access and workflows">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          {[
            ["Incoming Inspection", "Raw material verification"],
            ["In-Process Inspection", "Line-side checks and rejects"],
            ["Final Inspection", "Finished goods release"],
            ["NCR", "Non-conformance tracking"],
            ["CAPA", "Corrective action"],
            ["Rejections", "Reject and wastage review"],
          ].map(([title, description]) => (
            <div key={title} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px", background: "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <ShieldCheck size={16} color="#0f172a" />
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>{title}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "#667085" }}>{description}</div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
