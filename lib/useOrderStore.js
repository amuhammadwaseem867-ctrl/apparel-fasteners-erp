"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

import { PRODUCTION_STAGES, computeRemaining } from "@/config/production";
import { ORDER_STATUSES } from "@/config/orders";

/*
 * useOrderStore — frontend order state store.
 *
 * Provides real (in-memory) order CRUD, stage actions and
 * derived traceability used by the Orders list, Order Profile
 * and Stage Board until the backend API is connected.
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

function nowIso() {
  return new Date().toISOString();
}

function emptyStages() {
  return PRODUCTION_STAGES.map((stage) => ({
    stageType: stage.key,
    sequence: stage.sequence,
    label: stage.label,
    status: "pending",
    inputQuantity: 0,
    completedQuantity: 0,
    rejectedQuantity: 0,
    wastageQuantity: 0,
    remainingQuantity: 0,
    startedAt: null,
    completedAt: null,
    responsibleUserId: "",
    departmentId: stage.department,
    remarks: "",
    updatedBy: "",
    updatedAt: null,
  }));
}

function useOrderStore(initialOrders = []) {
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());

    updateCurrentTime();

    const timer = window.setInterval(updateCurrentTime, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const audit = useCallback(
    (order, action, field, oldValue, newValue, remarks) => {
      const entry = {
        timestamp: nowIso(),
        user: "Current User",
        action,
        field,
        oldValue,
        newValue,
        remarks,
      };
      return entry;
    },
    []
  );

  const createOrder = useCallback((data) => {
    const order = {
      id: `o-${Date.now()}`,
      orderNumber:
        data.orderNumber || `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      customerName: data.customerName || "",
      customerCode: data.customerCode || "",
      orderDate: data.orderDate || "",
      requiredDeliveryDate: data.requiredDeliveryDate || "",
      zipperType: data.zipperType || "",
      zipperSize: data.zipperSize || "",
      material: data.material || "",
      colorFinish: data.colorFinish || "",
      logoType: data.logoType || "plain",
      requiredQuantity: Number(data.requiredQuantity) || 0,
      unit: data.unit || "Pcs",
      productionPriority: data.productionPriority || "normal",
      currentStage: "tape-dyeing",
      status: data.status || "new",
      responsibleDepartment: data.responsibleDepartment || "sales",
      productionStartDate: data.productionStartDate || "",
      expectedCompletionDate: data.expectedCompletionDate || "",
      actualCompletionDate: "",
      deliveryStatus: data.deliveryStatus || "pending",
      remarks: data.remarks || "",
      stages: emptyStages(),
      attachments: [],
      audit: [],
      createdBy: "Current User",
      createdAt: nowIso(),
      updatedBy: "Current User",
      updatedAt: nowIso(),
    };

    if (order.status === "confirmed") {
      const first = order.stages[0];
      first.status = "ready";
    }

    order.audit.push(
      audit(order, "created", "order", "", order.orderNumber, "Order created")
    );

    setOrders((current) => [order, ...current]);

    return order;
  }, [audit]);

  const updateOrder = useCallback((orderId, patch, auditInfo) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const next = {
          ...order,
          ...patch,
          updatedBy: "Current User",
          updatedAt: nowIso(),
        };

        next.audit = [
          ...order.audit,
          {
            timestamp: nowIso(),
            user: "Current User",
            action: auditInfo?.action || "updated",
            field: auditInfo?.field || "",
            oldValue: auditInfo?.oldValue ?? "",
            newValue: auditInfo?.newValue ?? "",
            remarks: auditInfo?.remarks || "",
          },
        ];

        return next;
      })
    );
  }, []);

  const deleteOrder = useCallback((orderId) => {
    setOrders((current) =>
      current.filter((order) => order.id !== orderId)
    );
  }, []);

  /* ---- Stage actions ---- */

  const startStage = useCallback((orderId, stageKey) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const stages = order.stages.map((stage) => {
          if (stage.stageType !== stageKey) return stage;

          return {
            ...stage,
            status: "in-progress",
            startedAt: stage.startedAt || nowIso(),
            updatedBy: "Current User",
            updatedAt: nowIso(),
            inputQuantity: stage.inputQuantity || order.requiredQuantity,
            remainingQuantity: computeRemaining({
              inputQuantity: stage.inputQuantity || order.requiredQuantity,
              completedQuantity: stage.completedQuantity,
              rejectedQuantity: stage.rejectedQuantity,
              wastageQuantity: stage.wastageQuantity,
            }),
          };
        });

        return {
          ...order,
          stages,
          currentStage: stageKey,
          status: order.status === "confirmed" ? "in-production" : order.status,
          updatedBy: "Current User",
          updatedAt: nowIso(),
          audit: [
            ...order.audit,
            {
              timestamp: nowIso(),
              user: "Current User",
              action: "stage_started",
              field: "stage",
              oldValue: "",
              newValue: stageKey,
              remarks: "",
            },
          ],
        };
      })
    );
  }, []);

  const completeStage = useCallback(
    (orderId, stageKey, quantities) => {
      setOrders((current) =>
        current.map((order) => {
          if (order.id !== orderId) return order;

          const stageIndex = order.stages.findIndex(
            (stage) => stage.stageType === stageKey
          );

          if (stageIndex === -1) return order;

          const stage = order.stages[stageIndex];

          const completed = Number(quantities?.completedQuantity) || 0;
          const rejected = Number(quantities?.rejectedQuantity) || 0;
          const wastage = Number(quantities?.wastageQuantity) || 0;

          const remaining = computeRemaining({
            inputQuantity: stage.inputQuantity,
            completedQuantity: stage.completedQuantity + completed,
            rejectedQuantity: stage.rejectedQuantity + rejected,
            wastageQuantity: stage.wastageQuantity + wastage,
          });

          const updatedStages = order.stages.map((s, index) => {
            if (index === stageIndex) {
              return {
                ...s,
                completedQuantity: s.completedQuantity + completed,
                rejectedQuantity: s.rejectedQuantity + rejected,
                wastageQuantity: s.wastageQuantity + wastage,
                remainingQuantity: remaining,
                status: remaining === 0 ? "completed" : "in-progress",
                completedAt: remaining === 0 ? nowIso() : s.completedAt,
                remarks: quantities?.remarks || s.remarks,
                updatedBy: "Current User",
                updatedAt: nowIso(),
              };
            }

            /* next stage becomes eligible when the previous completes */
            if (index === stageIndex + 1 && remaining === 0) {
              return {
                ...s,
                status: "ready",
                inputQuantity: remaining,
                remainingQuantity: remaining,
              };
            }

            return s;
          });

          const lastStageKey =
            PRODUCTION_STAGES[PRODUCTION_STAGES.length - 1].key;

          const nextCurrentStage =
            remaining === 0
              ? PRODUCTION_STAGES[Math.min(stageIndex + 1, PRODUCTION_STAGES.length - 1)]
                .key
              : order.currentStage;

          let status = order.status;
          let deliveryStatus = order.deliveryStatus;
          let actualCompletionDate = order.actualCompletionDate;

          if (stageKey === "quality-check" && remaining === 0) {
            status = "qc-approved";
          } else if (stageKey === "packing" && remaining === 0) {
            status = "ready-for-delivery";
            deliveryStatus = "scheduled";
          } else if (stageKey === lastStageKey && remaining === 0) {
            status = "delivered";
            deliveryStatus = "delivered";
            actualCompletionDate = nowIso().slice(0, 10);
          } else if (status === "confirmed") {
            status = "in-production";
          }

          return {
            ...order,
            stages: updatedStages,
            currentStage: nextCurrentStage,
            status,
            deliveryStatus,
            actualCompletionDate,
            updatedBy: "Current User",
            updatedAt: nowIso(),
            audit: [
              ...order.audit,
              {
                timestamp: nowIso(),
                user: "Current User",
                action: "stage_completed",
                field: "stage_quantities",
                oldValue: `${stage.completedQuantity} completed`,
                newValue: `+${completed} completed, +${rejected} rejected, +${wastage} wastage`,
                remarks: quantities?.remarks || "",
              },
            ],
          };
        })
      );
    },
    []
  );

  const holdStage = useCallback((orderId, stageKey, remarks) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const stages = order.stages.map((stage) => {
          if (stage.stageType !== stageKey) return stage;

          return {
            ...stage,
            status: "paused",
            remarks: remarks || stage.remarks,
            updatedBy: "Current User",
            updatedAt: nowIso(),
          };
        });

        return {
          ...order,
          stages,
          status: "on-hold",
          updatedBy: "Current User",
          updatedAt: nowIso(),
          audit: [
            ...order.audit,
            {
              timestamp: nowIso(),
              user: "Current User",
              action: "stage_hold",
              field: "status",
              oldValue: "in-progress",
              newValue: "paused",
              remarks: remarks || "",
            },
          ],
        };
      })
    );
  }, []);

  const resumeStage = useCallback((orderId, stageKey) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const stages = order.stages.map((stage) => {
          if (stage.stageType !== stageKey) return stage;

          return {
            ...stage,
            status: "in-progress",
            updatedBy: "Current User",
            updatedAt: nowIso(),
          };
        });

        return {
          ...order,
          stages,
          status: "in-production",
          updatedBy: "Current User",
          updatedAt: nowIso(),
          audit: [
            ...order.audit,
            {
              timestamp: nowIso(),
              user: "Current User",
              action: "stage_resume",
              field: "status",
              oldValue: "paused",
              newValue: "in-progress",
              remarks: "",
            },
          ],
        };
      })
    );
  }, []);

  const setStatus = useCallback((orderId, status, remarks) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        return {
          ...order,
          status,
          updatedBy: "Current User",
          updatedAt: nowIso(),
          audit: [
            ...order.audit,
            {
              timestamp: nowIso(),
              user: "Current User",
              action: "status_changed",
              field: "status",
              oldValue: order.status,
              newValue: status,
              remarks: remarks || "",
            },
          ],
        };
      })
    );
  }, []);

  const addAttachment = useCallback((orderId, attachment) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        return {
          ...order,
          attachments: [
            ...order.attachments,
            {
              id: `att-${Date.now()}`,
              ...attachment,
              uploadedBy: "Current User",
              uploadedAt: nowIso(),
            },
          ],
          updatedBy: "Current User",
          updatedAt: nowIso(),
          audit: [
            ...order.audit,
            {
              timestamp: nowIso(),
              user: "Current User",
              action: "attachment_added",
              field: "attachments",
              oldValue: "",
              newValue: attachment.name,
              remarks: attachment.type,
            },
          ],
        };
      })
    );
  }, []);

  const removeAttachment = useCallback((orderId, attachmentId) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        return {
          ...order,
          attachments: order.attachments.filter(
            (attachment) => attachment.id !== attachmentId
          ),
          updatedBy: "Current User",
          updatedAt: nowIso(),
          audit: [
            ...order.audit,
            {
              timestamp: nowIso(),
              user: "Current User",
              action: "attachment_removed",
              field: "attachments",
              oldValue: attachmentId,
              newValue: "",
              remarks: "",
            },
          ],
        };
      })
    );
  }, []);

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
