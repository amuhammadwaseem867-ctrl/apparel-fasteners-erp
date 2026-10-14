"use client";

import { unavailableAction } from "@/lib/backendUnavailable";
import { useState } from "react";

/*
 * useQualityStore — QC state for the quality pages.
 *
 * There is no quality API or database table yet, so the lists are always
 * empty and every mutation throws BackendUnavailableError.
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

const MODULE_LABEL = "Quality control";

const createInspection = unavailableAction(MODULE_LABEL, "createInspection");
const setResult = unavailableAction(MODULE_LABEL, "setResult");
const createNcr = unavailableAction(MODULE_LABEL, "createNcr");
const setNcrStatus = unavailableAction(MODULE_LABEL, "setNcrStatus");
const createCapa = unavailableAction(MODULE_LABEL, "createCapa");
const setCapaStatus = unavailableAction(MODULE_LABEL, "setCapaStatus");

export default function useQualityStore() {
  const [inspections] = useState([]);
  const [ncrs] = useState([]);
  const [capas] = useState([]);

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
