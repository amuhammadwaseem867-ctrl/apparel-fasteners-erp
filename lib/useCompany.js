"use client";

import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";
import { apiRequest } from "@/lib/api/client";

/*
 * Company profile for printed documents: the administrator's settings
 * (Administration → Settings), falling back to config/company.js until
 * they load or if they cannot be read.
 */
export default function useCompany() {
  const [company, setCompany] = useState(COMPANY);

  useEffect(() => {
    let active = true;
    apiRequest("/api/settings")
      .then((data) => { if (active && data?.company) setCompany({ ...COMPANY, ...data.company }); })
      .catch(() => { /* keep the configured fallback */ });
    return () => { active = false; };
  }, []);

  return company;
}
