"use client";

import { useId } from "react";

/*
 * Storage location select grouped by warehouse. `locations` comes from
 * GET /api/inventory/locations (active locations only by default).
 */
export default function LocationSelect({ locations = [], value, onChange, label = "Location", required = false, exclude }) {
  const id = useId();
  const groups = new Map();

  for (const location of locations) {
    if (location.id === exclude) continue;
    const key = `${location.warehouseCode} · ${location.warehouseName}`;
    groups.set(key, [...(groups.get(key) ?? []), location]);
  }

  return (
    <div className="inv-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <select id={id} required={required} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select location</option>
        {[...groups.entries()].map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((location) => (
              <option key={location.id} value={location.id}>
                {location.warehouseCode}/{location.code} — {location.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {locations.length === 0 && (
        <small className="inv-field__hint">No active locations. Create a warehouse and location first.</small>
      )}
    </div>
  );
}
