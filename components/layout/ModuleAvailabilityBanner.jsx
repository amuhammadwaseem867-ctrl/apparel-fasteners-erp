"use client";

import { usePathname } from "next/navigation";

import Alert from "@/components/ui/Alert";
import { getModuleAvailability } from "@/config/moduleAvailability";

export default function ModuleAvailabilityBanner() {
  const pathname = usePathname();
  const availability = getModuleAvailability(pathname);

  if (!availability) {
    return null;
  }

  return (
    <div className="app-shell__availability">
      <Alert variant="warning" title={availability.title}>
        {availability.message}
      </Alert>
    </div>
  );
}
