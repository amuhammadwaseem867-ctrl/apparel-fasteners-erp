"use client";

import FinanceWorkspace from "@/components/finance/FinanceWorkspace";
import { accountsConfig } from "@/components/finance/financeConfigs";
import "./Accounts.css";

export default function AccountsPage() {
  return <FinanceWorkspace config={accountsConfig} />;
}
