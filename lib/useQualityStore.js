"use client";

import { useState, useCallback } from "react";

/*
 * useQualityStore — frontend QC state store.
 *
 * Inspection record (backend mirror):
 * { id, type (incoming | in-process | final), orderId,
 *   workOrderId, productionStage, batchId, product, quantity,
 *   inspector, result (approved | rejected | conditional),
 *   remarks, inspectedAt }
 *
 * NCR record:
 * { id, code, orderId, issue, severity, status (open |
 *   under-review | closed), createdAt }
 *
 * CAPA record:
 * { id, code, ncrId, action, owner, status, createdAt }
 */

function nowIso() {
  return new Date().toISOString();
}

export default function useQualityStore() {
  const [inspections, setInspections] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [capas, setCapas] = useState([]);

  const createInspection = useCallback((data) => {
    const inspection = {
      id: `insp-${Date.now()}`,
      type: data.type || "incoming",
      orderId: data.orderId || "",
      workOrderId: data.workOrderId || "",
      productionStage: data.productionStage || "",
      batchId: data.batchId || "",
      product: data.product || "",
      quantity: Number(data.quantity) || 0,
      inspector: data.inspector || "Current User",
      result: data.result || "pending",
      remarks: data.remarks || "",
      inspectedAt: nowIso(),
    };

    setInspections((current) => [inspection, ...current]);

    return inspection;
  }, []);

  const setResult = useCallback((inspectionId, result, remarks) => {
    setInspections((current) =>
      current.map((inspection) =>
        inspection.id === inspectionId
          ? { ...inspection, result, remarks: remarks || inspection.remarks }
          : inspection
      )
    );
  }, []);

  const createNcr = useCallback((data) => {
    const ncr = {
      id: `ncr-${Date.now()}`,
      code: data.code || `NCR-${Date.now().toString().slice(-4)}`,
      orderId: data.orderId || "",
      issue: data.issue || "",
      severity: data.severity || "Medium",
      status: "open",
      createdAt: nowIso(),
    };

    setNcrs((current) => [ncr, ...current]);

    return ncr;
  }, []);

  const setNcrStatus = useCallback((ncrId, status) => {
    setNcrs((current) =>
      current.map((ncr) =>
        ncr.id === ncrId ? { ...ncr, status } : ncr
      )
    );
  }, []);

  const createCapa = useCallback((data) => {
    const capa = {
      id: `capa-${Date.now()}`,
      code: data.code || `CAPA-${Date.now().toString().slice(-4)}`,
      ncrId: data.ncrId || "",
      action: data.action || "",
      owner: data.owner || "",
      status: data.status || "open",
      createdAt: nowIso(),
    };

    setCapas((current) => [capa, ...current]);

    return capa;
  }, []);

  const setCapaStatus = useCallback((capaId, status) => {
    setCapas((current) =>
      current.map((capa) =>
        capa.id === capaId ? { ...capa, status } : capa
      )
    );
  }, []);

  return {
    inspections,
    ncrs,
    capas,
    createInspection,
    setResult,
    createNcr,
    setNcrStatus,
    createCapa,
    setCapaStatus,
  };
}
