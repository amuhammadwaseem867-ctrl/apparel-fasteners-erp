"use client";

import { useId } from "react";

/*
 * Location typed by hand ("Shelf 3 Row 2", "Rack A"), with the existing
 * locations offered as suggestions. Choosing a suggestion sends its id; any
 * other text is sent as a new location name, which the server finds or
 * creates in the warehouse. Nothing has to be set up or activated first.
 * Left blank (not required, D-053), the server picks the location.
 */

export const locationLabel = (location) => `${location.code} — ${location.name}`;

export default function LocationInput({ locations = [], locationId, text, onChange, label = "Location", required = false, blankHint = "" }) {
  const id = useId();
  const current = locationId ? locations.find((location) => location.id === locationId) : null;
  const value = text ?? (current ? locationLabel(current) : "");

  function change(next) {
    const match = locations.find((location) => locationLabel(location) === next
      || location.code.toLowerCase() === next.trim().toLowerCase()
      || location.name.toLowerCase() === next.trim().toLowerCase());
    onChange({ locationId: match?.id ?? "", locationText: next });
  }

  return (
    <div className="inv-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <input id={id} list={`${id}-list`} required={required} maxLength={60} value={value}
        placeholder="e.g. Shelf 3 Row 2" autoComplete="off" onChange={(event) => change(event.target.value)} />
      <datalist id={`${id}-list`}>
        {locations.map((location) => <option key={location.id} value={locationLabel(location)} />)}
      </datalist>
      <small className="inv-field__hint">{required
        ? "Pick one or type a new location; a new one is added automatically."
        : `Optional. Pick one, type a new one, or leave blank${blankHint ? `: ${blankHint}` : ""}.`}</small>
    </div>
  );
}
