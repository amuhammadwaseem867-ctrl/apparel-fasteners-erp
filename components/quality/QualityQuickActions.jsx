"use client";

import {
  ClipboardCheck,
  FileWarning,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import "./QualityQuickActions.css";

export default function QualityQuickActions({
  onInspection,
  onNcr,
  onCapa,
  onRejection,
}) {
  return (
    <Card
      title="Quality Actions"
      description="Common quality control workflows."
      className="quality-quick-actions"
    >
      <div className="quality-quick-actions__grid">
        <Button
          variant="secondary"
          icon={ClipboardCheck}
          onClick={onInspection}
        >
          New Inspection
        </Button>

        <Button
          variant="secondary"
          icon={FileWarning}
          onClick={onNcr}
        >
          Create NCR
        </Button>

        <Button
          variant="secondary"
          icon={ShieldCheck}
          onClick={onCapa}
        >
          Create CAPA
        </Button>

        <Button
          variant="secondary"
          icon={XCircle}
          onClick={onRejection}
        >
          Record Rejection
        </Button>
      </div>
    </Card>
  );
}