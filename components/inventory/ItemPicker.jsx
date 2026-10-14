"use client";

import { useEffect, useId, useState } from "react";

import { apiRequest } from "@/lib/api/client";

/*
 * Searches the item master on the server (SKU or name) and returns the
 * chosen item. Archived items are excluded by the products API.
 */
export default function ItemPicker({ value, onChange, label = "Item", required = false, disabled = false }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search: query, pageSize: "20", page: "1" });
      apiRequest(`/api/products?${params}`)
        .then((result) => {
          if (active) {
            setOptions(result.products ?? []);
            setError("");
          }
        })
        .catch((cause) => {
          if (active) setError(cause.message);
        });
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  return (
    <div className="inv-field inv-picker">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {value ? (
        <div className="inv-picker__chosen">
          <span>
            <strong>{value.sku}</strong> {value.name}
            <small> · {value.unit}</small>
          </span>
          {!disabled && (
            <button type="button" onClick={() => { onChange(null); setQuery(""); }} aria-label="Change item">
              Change
            </button>
          )}
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            value={query}
            placeholder="Search SKU or item name"
            autoComplete="off"
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          />
          {open && (
            <ul className="inv-picker__options" role="listbox">
              {error && <li className="inv-picker__note" role="alert">{error}</li>}
              {!error && options.length === 0 && <li className="inv-picker__note">No matching items.</li>}
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => { onChange(option); setOpen(false); }}
                  >
                    <strong>{option.sku}</strong>
                    <span>{option.name}</span>
                    <small>{[option.size, option.finish, option.logoType, option.unit].filter(Boolean).join(" · ")}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
