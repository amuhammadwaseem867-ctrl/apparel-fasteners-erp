"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { incomeConfig } from "@/components/finance/financeConfigs";
import "./Income.css";

export default function IncomePage() {
  return <FinanceWorkspace config={incomeConfig} />;
}
