"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { expensesConfig } from "@/components/finance/financeConfigs";
import "./Expenses.css";

export default function ExpensesPage() {
  return <FinanceWorkspace config={expensesConfig} />;
}
