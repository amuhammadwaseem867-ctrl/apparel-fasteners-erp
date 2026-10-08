"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { reportsConfig } from "@/components/finance/financeConfigs";
import "./FinancialReports.css";

export default function FinancialReportsPage() {
  return <FinanceWorkspace config={reportsConfig} />;
}
