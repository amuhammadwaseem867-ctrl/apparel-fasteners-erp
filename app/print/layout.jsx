import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/auth.service";

import "./print.css";

/*
 * Printable documents render without the ERP shell (no sidebar, top bar
 * or banners) but require the same session as the ERP. Each document
 * loads its data through the normal API, so the API's permission check
 * decides whether the user may see (and therefore print) the record.
 */

async function AuthenticatedPrint({ children }) {
  await connection();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("erp_session")?.value ?? null;

  const user = await getCurrentUser(sessionToken);

  if (!user) {
    redirect("/login");
  }

  return children;
}

export default function PrintLayout({ children }) {
  return (
    <Suspense fallback={<p className="print-doc__state">Loading document...</p>}>
      <AuthenticatedPrint>{children}</AuthenticatedPrint>
    </Suspense>
  );
}
