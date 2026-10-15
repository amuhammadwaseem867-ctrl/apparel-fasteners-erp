"use client";

import useApiData from "@/lib/inventory/useApiData";

/*
 * The signed-in user and permissions from GET /api/auth/session. Use only
 * to show or hide controls; the server checks every permission again.
 */
export default function useCurrentUser() {
  const session = useApiData("/api/auth/session");
  const permissions = session.data?.permissions ?? [];
  return { user: session.data, loading: session.loading, can: (permission) => permissions.includes(permission) };
}
