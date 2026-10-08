"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { paymentsConfig } from "@/components/finance/financeConfigs";
import "./Payments.css";

export default function PaymentsPage() {
  return <FinanceWorkspace config={paymentsConfig} />;
}
