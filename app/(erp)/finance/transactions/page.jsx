"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { transactionsConfig } from "@/components/finance/financeConfigs";
import "./Transactions.css";

export default function TransactionsPage() {
  return <FinanceWorkspace config={transactionsConfig} />;
}
