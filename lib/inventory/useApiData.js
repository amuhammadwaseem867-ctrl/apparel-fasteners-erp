"use client";

import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";

/*
 * Loads an API path and exposes { data, loading, error, reload }.
 * Pass null to skip loading. Responses for a path that has since changed
 * are discarded, so fast filter changes never show stale results.
 */
export default function useApiData(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: "" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) {
      return undefined;
    }

    let active = true;

    apiRequest(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((cause) => {
        if (active) setState((current) => ({ ...current, loading: false, error: cause?.message || "Unable to load data." }));
      });

    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setVersion((current) => current + 1);
  }, []);

  return { ...state, loading: path ? state.loading : false, reload };
}

export function toQuery(params) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined),
  );
  const text = search.toString();
  return text ? `?${text}` : "";
}
