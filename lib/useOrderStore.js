"use client";

import { unavailableAction } from "@/lib/backendUnavailable";
import { useEffect, useState, useCallback } from "react";


/*
 * useOrderStore — frontend order state store.
 *
 * Read-only production order state for the Orders list and Stage
 * Board. There is no production API or database table yet, so the
 * list is always empty and every mutation throws
 * BackendUnavailableError (it previously kept orders in browser
 * memory only).
 *
 * Order entity (backend mirror):
 * {
 *   orderNumber, customerName, customerCode, orderDate,
 *   requiredDeliveryDate, zipperType, zipperSize, material,
 *   colorFinish, logoType, requiredQuantity, unit,
 *   productionPriority, currentStage, status,
 *   responsibleDepartment, productionStartDate,
 *   expectedCompletionDate, actualCompletionDate,
 *   deliveryStatus, remarks,
 *   stages: [ ProductionStageRecord ],
 *   attachments: [ { id, type, name, size, uploadedBy, uploadedAt } ],
 *   audit: [ { timestamp, user, action, field, oldValue, newValue, remarks } ],
 *   createdBy, createdAt, updatedBy, updatedAt
 * }
 */

const MODULE_LABEL = "Production order";

const createOrder = unavailableAction(MODULE_LABEL, "createOrder");
const updateOrder = unavailableAction(MODULE_LABEL, "updateOrder");
const deleteOrder = unavailableAction(MODULE_LABEL, "deleteOrder");
const startStage = unavailableAction(MODULE_LABEL, "startStage");
const completeStage = unavailableAction(MODULE_LABEL, "completeStage");
const holdStage = unavailableAction(MODULE_LABEL, "holdStage");
const resumeStage = unavailableAction(MODULE_LABEL, "resumeStage");
const setStatus = unavailableAction(MODULE_LABEL, "setStatus");
const addAttachment = unavailableAction(MODULE_LABEL, "addAttachment");
const removeAttachment = unavailableAction(MODULE_LABEL, "removeAttachment");

function useOrderStore(initialOrders = []) {
  const [orders] = useState(initialOrders);
  const [loading] = useState(false);
  const [error] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());

    updateCurrentTime();

    const timer = window.setInterval(updateCurrentTime, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  /* ---- Stage actions ---- */

  const getOrder = useCallback(
    (orderId) => orders.find((order) => order.id === orderId) || null,
    [orders]
  );

  /* ---- Derived helpers ---- */

  const stageProgress = useCallback((order) => {
    if (!order) return 0;

    const completed = order.stages.filter(
      (stage) => stage.status === "completed"
    ).length;

    return Math.round((completed / order.stages.length) * 100);
  }, []);

  const delayed = useCallback((order) => {
    if (!order?.expectedCompletionDate) return false;
    if (currentTime === null) return false;

    const expected = new Date(order.expectedCompletionDate);
    if (Number.isNaN(expected.getTime())) return false;

    return (
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      currentTime > expected.getTime()
    );
  }, [currentTime]);

  return {
    orders,
    loading,
    error,
    createOrder,
    updateOrder,
    deleteOrder,
    startStage,
    completeStage,
    holdStage,
    resumeStage,
    setStatus,
    addAttachment,
    removeAttachment,
    getOrder,
    stageProgress,
    delayed,
  };
}

export default useOrderStore;
