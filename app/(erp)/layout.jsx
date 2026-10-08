import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { PeoplePayrollStoreProvider } from "@/lib/usePeoplePayrollStore";
import { getCurrentUser } from "@/server/auth/auth.service";

async function AuthenticatedERP({ children }) {
  await connection();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("erp_session")?.value ?? null;

  const user = await getCurrentUser(sessionToken);

  if (!user) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <PeoplePayrollStoreProvider>
        <AppShell>{children}</AppShell>
      </PeoplePayrollStoreProvider>
    </ToastProvider>
  );
}

function ERPAuthFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <strong>Loading Apparel Fastener ERP...</strong>
      </div>
    </div>
  );
}

export default function ERPLayout({ children }) {
  return (
    <Suspense fallback={<ERPAuthFallback />}>
      <AuthenticatedERP>{children}</AuthenticatedERP>
    </Suspense>
  );
}
