"use client";

import { useState, useCallback } from "react";

import { MOVEMENT_TYPES, UNITS } from "@/config/items";

/*
 * useInventoryStore — frontend inventory state store.
 *
 * Item entity (backend mirror):
 * { sku, itemName, category, subcategory, size, material, type,
 *   finish, color, variant, logoType, warehouse, location,
 *   minimumStock, currentStock, reservedStock, availableStock,
 *   wipStock, unit }
 *
 * Movement / transaction entity:
 * { id, type (MOVEMENT_TYPES key), itemId (sku), quantity, unit,
 *   warehouse, location, reference, user, remarks, createdAt }
 */

function nowIso() {
  return new Date().toISOString();
}

export default function useInventoryStore(initialItems = []) {
  const [items, setItems] = useState(initialItems);
  const [movements, setMovements] = useState([]);

  const adjustStock = useCallback((sku, delta) => {
    setItems((current) =>
      current.map((item) =>
        item.sku === sku
          ? { ...item, currentStock: Math.max(0, item.currentStock + delta) }
          : item
      )
    );
  }, []);

  const recordMovement = useCallback(
    ({ type, itemId, quantity, unit, warehouse, location, reference, remarks }) => {
      const movementType = MOVEMENT_TYPES.find((m) => m.id === type);

      const movement = {
        id: `mov-${Date.now()}`,
        type,
        typeLabel: movementType?.label || type,
        direction:
          movementType?.direction === "in"
            ? "in"
            : movementType?.direction === "out"
              ? "out"
              : "transfer",
        itemId,
        quantity: Number(quantity) || 0,
        unit: unit || "Pcs",
        warehouse: warehouse || "",
        location: location || "",
        reference: reference || "",
        user: "Current User",
        remarks: remarks || "",
        createdAt: nowIso(),
      };

      setMovements((current) => [movement, ...current]);

      /* apply stock effect for in/out movements */
      if (movement.direction === "in") {
        adjustStock(itemId, movement.quantity);
      } else if (movement.direction === "out") {
        adjustStock(itemId, -movement.quantity);
      }

      return movement;
    },
    [adjustStock]
  );

  const createItem = useCallback((data) => {
    const item = {
      sku: data.sku || `SKU-${Date.now().toString().slice(-6)}`,
      itemName: data.itemName || "",
      category: data.category || "",
      subcategory: data.subcategory || "",
      size: data.size || "",
      material: data.material || "",
      type: data.type || "",
      finish: data.finish || "",
      color: data.color || "",
      variant: data.variant || "",
      logoType: data.logoType || "",
      warehouse: data.warehouse || "",
      location: data.location || "",
      minimumStock: Number(data.minimumStock) || 0,
      currentStock: Number(data.currentStock) || 0,
      reservedStock: 0,
      availableStock: Number(data.currentStock) || 0,
      wipStock: 0,
      unit: data.unit || "Pcs",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setItems((current) => [item, ...current]);

    return item;
  }, []);

  return {
    items,
    movements,
    createItem,
    recordMovement,
    adjustStock,
  };
}

export { UNITS };
