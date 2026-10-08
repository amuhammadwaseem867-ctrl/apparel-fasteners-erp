"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { receivablesConfig } from "@/components/finance/financeConfigs";
import "./Receivables.css";

export default function ReceivablesPage() {
  return <FinanceWorkspace config={receivablesConfig} />;
}
