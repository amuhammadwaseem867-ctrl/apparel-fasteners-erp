"use client";

import { useState, useCallback } from "react";

/*
 * useFulfillmentStore — frontend state connecting
 * Packing → Ready for Delivery → Dispatch → Shipment → Delivered.
 *
 * Packing order:
 * { id, orderId, product, approvedQuantity, packedQuantity,
 *   packageType, packageCount, weight, dimensions,
 *   instructions, specialInstructions, unit, status
 *   (open | in-progress | completed | ready), packedBy, packedAt }
 *
 * Shipment:
 * { id, code, orderId, packageCount, weight, carrier,
 *   trackingNumber, dispatchDate, expectedDelivery, deliveryDate,
 *   status (dispatched | in-transit | delivered), address, remarks }
 */

function nowIso() {
  return new Date().toISOString();
}

export default function useFulfillmentStore() {
  const [packingOrders, setPackingOrders] = useState([]);
  const [shipments, setShipments] = useState([]);

  const createPackingOrder = useCallback((data) => {
    const record = {
      id: `pack-${Date.now()}`,
      orderId: data.orderId || "",
      product: data.product || "",
      approvedQuantity: Number(data.approvedQuantity) || 0,
      packedQuantity: 0,
      packageType: data.packageType || "Carton",
      packageCount: data.packageCount || "",
      weight: data.weight || "",
      dimensions: data.dimensions || "",
      instructions: data.instructions || "",
      specialInstructions: data.specialInstructions || "",
      unit: data.unit || "Pcs",
      status: "open",
      packedBy: "",
      packedAt: null,
      createdAt: nowIso(),
    };

    setPackingOrders((current) => [record, ...current]);

    return record;
  }, []);

  const pack = useCallback((packingId, quantity) => {
    setPackingOrders((current) =>
      current.map((order) => {
        if (order.id !== packingId) return order;

        const packed = order.packedQuantity + quantity;
        const remaining = order.approvedQuantity - packed;

        return {
          ...order,
          packedQuantity: packed,
          packedBy: "Current User",
          packedAt: nowIso(),
          status: remaining <= 0 ? "completed" : "in-progress",
        };
      })
    );
  }, []);

  const markReady = useCallback((packingId) => {
    setPackingOrders((current) =>
      current.map((order) =>
        order.id === packingId ? { ...order, status: "ready" } : order
      )
    );
  }, []);

  const readyOrders = packingOrders.filter(
    (order) => order.status === "ready"
  );

  const dispatch = useCallback(
    (packingId, { carrier, trackingNumber, expectedDelivery, address, remarks }) => {
      const order = packingOrders.find((o) => o.id === packingId);

      if (!order) return null;

      const shipment = {
        id: `ship-${Date.now()}`,
        code: `SHP-${Date.now().toString().slice(-6)}`,
        orderId: order.orderId,
        packageCount: order.packageCount,
        weight: order.weight,
        carrier: carrier || "",
        trackingNumber: trackingNumber || "",
        dispatchDate: nowIso().slice(0, 10),
        expectedDelivery: expectedDelivery || "",
        deliveryDate: "",
        status: "dispatched",
        address: address || "",
        remarks: remarks || "",
      };

      setShipments((current) => [shipment, ...current]);

      setPackingOrders((current) =>
        current.filter((o) => o.id !== packingId)
      );

      return shipment;
    },
    [packingOrders]
  );

  const markDelivered = useCallback((shipmentId, deliveryDate) => {
    setShipments((current) =>
      current.map((shipment) =>
        shipment.id === shipmentId
          ? {
            ...shipment,
            status: "delivered",
            deliveryDate: deliveryDate || nowIso().slice(0, 10),
          }
          : shipment
      )
    );
  }, []);

  return {
    packingOrders,
    shipments,
    readyOrders,
    createPackingOrder,
    pack,
    markReady,
    dispatch,
    markDelivered,
  };
}
