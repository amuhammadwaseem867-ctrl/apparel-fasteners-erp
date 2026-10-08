"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { payablesConfig } from "@/components/finance/financeConfigs";
import "./Payables.css";

export default function PayablesPage() {
  return <FinanceWorkspace config={payablesConfig} />;
}
