"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { cashBankConfig } from "@/components/finance/financeConfigs";
import "./CashBank.css";

export default function CashBankPage() {
  return <FinanceWorkspace config={cashBankConfig} />;
}
