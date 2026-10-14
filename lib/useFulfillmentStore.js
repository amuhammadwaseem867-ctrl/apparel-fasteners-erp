"use client";

import { unavailableAction } from "@/lib/backendUnavailable";
import { useState } from "react";

/*
 * useFulfillmentStore — packing and dispatch state.
 *
 * There is no packing/dispatch API or database table yet, so the lists are
 * always empty and every mutation throws BackendUnavailableError.
 *
 * Flow it will connect:
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

const MODULE_LABEL = "Packing and dispatch";

const createPackingOrder = unavailableAction(MODULE_LABEL, "createPackingOrder");
const pack = unavailableAction(MODULE_LABEL, "pack");
const markReady = unavailableAction(MODULE_LABEL, "markReady");
const dispatch = unavailableAction(MODULE_LABEL, "dispatch");
const markDelivered = unavailableAction(MODULE_LABEL, "markDelivered");

export default function useFulfillmentStore() {
  const [packingOrders] = useState([]);
  const [shipments] = useState([]);

  const readyOrders = packingOrders.filter(
    (order) => order.status === "ready"
  );

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
