"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { invoicesConfig } from "@/components/finance/financeConfigs";
import "./Invoices.css";

export default function InvoicesPage() {
  return <FinanceWorkspace config={invoicesConfig} />;
}
