import JournalClient from "@/components/ledger/JournalClient";

export default async function TransactionsPage({ searchParams }) {
  const params = await searchParams;
  return <JournalClient initialEntry={params?.entry ?? ""} />;
}

export const instant = false;
