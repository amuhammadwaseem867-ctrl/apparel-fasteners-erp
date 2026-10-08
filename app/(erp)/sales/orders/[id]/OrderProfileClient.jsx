"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleDot,
  FileText,
  PauseCircle,
  PlayCircle,
  Pencil,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";

import useOrderStore from "@/lib/useOrderStore";
import { PRODUCTION_STAGES, getStage } from "@/config/production";
import { ORDER_STATUSES, ORDER_ATTACHMENT_TYPES } from "@/config/orders";

import "./OrderProfile.css";

function StageRow({ stage, delayed, actions }) {
  const state =
    stage.status === "completed"
      ? "completed"
      : stage.status === "in-progress"
        ? "current"
        : "pending";

  const StateIcon =
    state === "completed"
      ? CheckCircle2
      : state === "current"
        ? CircleDot
        : Circle;

  const qty = {
    input: stage.inputQuantity,
    completed: stage.completedQuantity,
    rejected: stage.rejectedQuantity,
    wastage: stage.wastageQuantity,
    remaining: stage.remainingQuantity,
  };

  return (
    <div
      className={`order-profile__stage order-profile__stage--${state}${
        delayed ? " order-profile__stage--delayed" : ""
      }`}
    >
      <div className="order-profile__stage-marker">
        <StateIcon size={20} strokeWidth={1.8} />
      </div>

      <div className="order-profile__stage-main">
        <div className="order-profile__stage-title">
          <strong>{stage.label}</strong>

          <span className="order-profile__stage-badge">
            {stage.status === "in-progress"
              ? "In Progress"
              : stage.status === "completed"
                ? "Completed"
                : stage.status === "ready"
                  ? "Ready"
                  : stage.status === "paused"
                    ? "On Hold"
                    : "Pending"}
          </span>

          {delayed && (
            <span className="order-profile__stage-delayed-badge">
              <TriangleAlert size={12} strokeWidth={2} />
              Delayed
            </span>
          )}

          <div className="order-profile__stage-actions">{actions}</div>
        </div>

        <div className="order-profile__stage-meta">
          {stage.startedAt && (
            <span>
              Started: <b>{new Date(stage.startedAt).toLocaleString()}</b>
            </span>
          )}

          {stage.completedAt && (
            <span>
              Completed: <b>{new Date(stage.completedAt).toLocaleString()}</b>
            </span>
          )}

          {stage.remarks && (
            <span>
              Remarks: <b>{stage.remarks}</b>
            </span>
          )}

          {stage.updatedBy && stage.updatedAt && (
            <span>
              Updated by <b>{stage.updatedBy}</b> at{" "}
              <b>{new Date(stage.updatedAt).toLocaleString()}</b>
            </span>
          )}
        </div>

        <div className="order-profile__stage-qty">
          <span>
            Input <b>{qty.input.toLocaleString()}</b>
          </span>

          <span>
            Completed <b>{qty.completed.toLocaleString()}</b>
          </span>

          <span className="order-profile__qty-reject">
            Rejected <b>{qty.rejected.toLocaleString()}</b>
          </span>

          <span className="order-profile__qty-waste">
            Wastage <b>{qty.wastage.toLocaleString()}</b>
          </span>

          <span className="order-profile__qty-remaining">
            Remaining <b>{qty.remaining.toLocaleString()}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OrderProfileClient({ id }) {
  const router = useRouter();
  const toast = useToast();

  const orderId = id;

  const {
    getOrder,
    startStage,
    completeStage,
    holdStage,
    resumeStage,
    setStatus,
    deleteOrder,
    addAttachment,
    removeAttachment,
    stageProgress,
    delayed,
  } = useOrderStore([]);

  const order = getOrder(orderId);

  const [completeDialog, setCompleteDialog] = useState(null);
  const [completedQty, setCompletedQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("0");
  const [wastageQty, setWastageQty] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusNext, setStatusNext] = useState("");
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachmentType, setAttachmentType] = useState("purchase-order");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const progress = useMemo(() => stageProgress(order), [order, stageProgress]);

  if (!order) {
    return (
      <main className="order-profile">
        <PageHeader
          eyebrow="Business / Sales & CRM / Orders"
          title="Order Profile"
          description="Complete order traceability: production stages, QC, packing, dispatch and delivery."
          action={
            <Link href="/sales/orders">
              <Button variant="secondary" icon={ArrowLeft}>
                Back to Orders
              </Button>
            </Link>
          }
        />

        <div className="order-profile__content">
          <section className="order-profile__empty-card">
            <EmptyState
              icon={FileText}
              title="Order not found"
              description="This order doesn't exist in the current ERP state. It may have been deleted, or the backend isn't connected yet. Create an order from the Orders list to see the full profile with live stage tracking."
              action={
                <Link href="/sales/orders">
                  <Button variant="primary">Go to Orders</Button>
                </Link>
              }
            />
          </section>
        </div>
      </main>
    );
  }

  const currentStage = getStage(order.currentStage);
  const isDelayed = delayed(order);

  function openCompleteDialog(stageKey) {
    setCompleteDialog(stageKey);
    setCompletedQty("");
    setRejectedQty("0");
    setWastageQty("0");
    setRemarks("");
  }

  function handleComplete() {
    if (!completeDialog) return;

    setSubmitting(true);

    completeStage(order.id, completeDialog, {
      completedQuantity: Number(completedQty) || 0,
      rejectedQuantity: Number(rejectedQty) || 0,
      wastageQuantity: Number(wastageQty) || 0,
      remarks,
    });

    setSubmitting(false);
    setCompleteDialog(null);

    toast.success({
      title: "Stage updated",
      message: `${getStage(completeDialog)?.label} quantities recorded.`,
    });
  }

  function handleDelete() {
    setSubmitting(true);

    deleteOrder(order.id);

    setSubmitting(false);
    setDeleteOpen(false);

    toast.success({
      title: "Order deleted",
      message: `${order.orderNumber} was removed.`,
    });

    router.push("/sales/orders");
  }

  function handleStatusChange() {
    if (!statusNext) return;

    setSubmitting(true);

    setStatus(order.id, statusNext, remarks);

    setSubmitting(false);
    setStatusOpen(false);
    setStatusNext("");
    setRemarks("");

    toast.success({ title: "Status updated" });
  }

  function handleAttachmentUpload() {
    if (!attachmentName.trim()) return;

    setSubmitting(true);

    addAttachment(order.id, {
      type: attachmentType,
      name: attachmentName.trim(),
      size: attachmentFile ? attachmentFile.size : 0,
    });

    setSubmitting(false);
    setAttachmentOpen(false);
    setAttachmentName("");
    setAttachmentFile(null);

    toast.success({ title: "Attachment added" });
  }

  function handleRemoveAttachment(id) {
    removeAttachment(order.id, id);

    toast.success({ title: "Attachment removed" });
  }

  return (
    <main className="order-profile">
      <PageHeader
        eyebrow="Business / Sales & CRM / Orders"
        title={order.orderNumber}
        description={`${order.customerName || "No customer"} · ${
          ORDER_STATUSES.find((s) => s.id === order.status)?.label
        } · ${currentStage?.label || "No stage"}`}
        action={
          <div className="order-profile__header-actions">
            <Link href="/sales/orders">
              <Button variant="secondary" icon={ArrowLeft}>
                Orders
              </Button>
            </Link>

            <Button
              variant="secondary"
              icon={Pencil}
              onClick={() => router.push(`/sales/orders/${order.id}/edit`)}
            >
              Edit
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                setStatusNext(order.status);
                setStatusOpen(true);
              }}
            >
              Change Status
            </Button>

            <Button
              variant="secondary"
              icon={Trash2}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="order-profile__content">
        {/* SUMMARY */}
        <section className="order-profile__summary">
          <div className="order-profile__summary-card">
            <h3>Order Summary</h3>

            <div className="order-profile__summary-grid">
              <div>
                <span>Order Number</span>
                <strong>{order.orderNumber}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {ORDER_STATUSES.find((s) => s.id === order.status)?.label}
                </strong>
              </div>

              <div>
                <span>Current Stage</span>
                <strong>{currentStage?.label || "—"}</strong>
              </div>

              <div>
                <span>Progress</span>
                <strong>{progress}%</strong>
              </div>

              <div>
                <span>Order Date</span>
                <strong>{order.orderDate || "—"}</strong>
              </div>

              <div>
                <span>Required Delivery</span>
                <strong>{order.requiredDeliveryDate || "—"}</strong>
              </div>

              <div>
                <span>Priority</span>
                <strong>{order.productionPriority}</strong>
              </div>

              <div>
                <span>Department</span>
                <strong>{order.responsibleDepartment}</strong>
              </div>
            </div>

            {isDelayed && (
              <div className="order-profile__delayed-banner">
                <TriangleAlert size={16} strokeWidth={1.8} />

                <span>This order is past its expected completion date.</span>
              </div>
            )}
          </div>

          <div className="order-profile__summary-card">
            <h3>Quantity Summary</h3>

            <div className="order-profile__qty-grid">
              <div>
                <span>Required</span>
                <strong>
                  {order.requiredQuantity.toLocaleString()} {order.unit}
                </strong>
              </div>

              <div>
                <span>Completed (current stage)</span>
                <strong>
                  {order.stages.find(
                    (stage) => stage.stageType === order.currentStage
                  )?.completedQuantity.toLocaleString() || 0}
                </strong>
              </div>

              <div>
                <span>Rejected (total)</span>
                <strong className="order-profile__qty-reject">
                  {order.stages
                    .reduce((sum, stage) => sum + stage.rejectedQuantity, 0)
                    .toLocaleString()}
                </strong>
              </div>

              <div>
                <span>Wastage (total)</span>
                <strong className="order-profile__qty-waste">
                  {order.stages
                    .reduce((sum, stage) => sum + stage.wastageQuantity, 0)
                    .toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          <div className="order-profile__summary-card">
            <h3>Customer Information</h3>

            <div className="order-profile__summary-grid">
              <div>
                <span>Customer Name</span>
                <strong>{order.customerName || "—"}</strong>
              </div>

              <div>
                <span>Customer Code</span>
                <strong>{order.customerCode || "—"}</strong>
              </div>
            </div>
          </div>

          <div className="order-profile__summary-card">
            <h3>Product Specification</h3>

            <div className="order-profile__summary-grid">
              <div>
                <span>Zipper Type</span>
                <strong>{order.zipperType || "—"}</strong>
              </div>

              <div>
                <span>Size</span>
                <strong>{order.zipperSize || "—"}</strong>
              </div>

              <div>
                <span>Material</span>
                <strong>{order.material || "—"}</strong>
              </div>

              <div>
                <span>Color / Finish</span>
                <strong>{order.colorFinish || "—"}</strong>
              </div>

              <div>
                <span>Logo / Plain</span>
                <strong>{order.logoType === "logo" ? "Logo" : "Plain"}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* STAGE TIMELINE */}
        <section className="order-profile__stages-card">
          <div className="order-profile__section-heading">
            <div>
              <h2>Production Timeline</h2>

              <p>
                All nine factory stages. Start, complete, hold and
                resume stages — quantities carry forward to the next
                stage when a stage completes.
              </p>
            </div>
          </div>

          <div className="order-profile__stages">
            {order.stages.map((stage) => {
              const isCurrent = order.currentStage === stage.stageType;

              const actions = (
                <>
                  {stage.status === "pending" && isCurrent && (
                    <Button
                      variant="primary"
                      size="small"
                      icon={PlayCircle}
                      onClick={() => {
                        startStage(order.id, stage.stageType);
                        toast.info({
                          title: "Stage started",
                          message: `${stage.label} is now in progress.`,
                        });
                      }}
                    >
                      Start Stage
                    </Button>
                  )}

                  {(stage.status === "in-progress" ||
                    stage.status === "ready") && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => openCompleteDialog(stage.stageType)}
                    >
                      Complete Stage
                    </Button>
                  )}

                  {stage.status === "in-progress" && (
                    <Button
                      variant="secondary"
                      size="small"
                      icon={PauseCircle}
                      onClick={() => {
                        holdStage(order.id, stage.stageType, "On hold by user");
                        toast.warning({
                          title: "Stage on hold",
                          message: `${stage.label} was put on hold.`,
                        });
                      }}
                    >
                      Hold
                    </Button>
                  )}

                  {stage.status === "paused" && (
                    <Button
                      variant="secondary"
                      size="small"
                      icon={PlayCircle}
                      onClick={() => {
                        resumeStage(order.id, stage.stageType);
                        toast.info({
                          title: "Stage resumed",
                          message: `${stage.label} resumed.`,
                        });
                      }}
                    >
                      Resume
                    </Button>
                  )}
                </>
              );

              return (
                <StageRow
                  stage={stage}
                  delayed={
                    stage.status === "in-progress" &&
                    isDelayed
                  }
                  actions={actions}
                  key={stage.stageType}
                />
              );
            })}
          </div>
        </section>

        {/* PRODUCTION HISTORY */}
        <section className="order-profile__history-card">
          <div className="order-profile__section-heading">
            <div>
              <h2>Production History &amp; Audit</h2>

              <p>
                Every change on this order: who did it, when, from
                which value to which.
              </p>
            </div>
          </div>

          {order.audit.length === 0 ? (
            <div className="order-profile__history-empty">
              <span>No history recorded yet.</span>
            </div>
          ) : (
            <div className="order-profile__history-list">
              {[...order.audit].reverse().map((entry, index) => (
                <div className="order-profile__history-item" key={index}>
                  <span className="order-profile__history-dot" />

                  <div className="order-profile__history-content">
                    <strong>
                      {entry.action.replace(/_/g, " ")}
                      {entry.newValue ? ` — ${entry.newValue}` : ""}
                    </strong>

                    <span>
                      {entry.user} ·{" "}
                      {new Date(entry.timestamp).toLocaleString()}
                      {entry.oldValue ? ` (was: ${entry.oldValue})` : ""}
                      {entry.remarks ? ` · ${entry.remarks}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ATTACHMENTS */}
        <section className="order-profile__attachments-card">
          <div className="order-profile__section-heading order-profile__section-heading--row">
            <div>
              <h2>Attachments</h2>

              <p>
                Purchase Order, Order Sheet, Specification, Artwork /
                Logo, Packing Instructions and other documents.
              </p>
            </div>

            <Button
              variant="primary"
              size="small"
              icon={Upload}
              onClick={() => setAttachmentOpen(true)}
            >
              Upload
            </Button>
          </div>

          {order.attachments.length === 0 ? (
            <div className="order-profile__attachments-empty">
              <span>No attachments yet.</span>
            </div>
          ) : (
            <div className="order-profile__attachments-list">
              {order.attachments.map((attachment) => (
                <div className="order-profile__attachment" key={attachment.id}>
                  <div className="order-profile__attachment-main">
                    <strong>{attachment.name}</strong>

                    <span>
                      {ORDER_ATTACHMENT_TYPES.find(
                        (type) => type.id === attachment.type
                      )?.label || attachment.type}
                      {attachment.size
                        ? ` · ${(attachment.size / 1024).toFixed(1)} KB`
                        : ""}{" "}
                      · {attachment.uploadedBy} ·{" "}
                      {new Date(attachment.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="icon"
                    icon={X}
                    aria-label="Remove attachment"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* REMARKS */}
        {order.remarks && (
          <section className="order-profile__remarks-card">
            <h2>Remarks / Special Instructions</h2>

            <p>{order.remarks}</p>
          </section>
        )}
      </div>

      {/* COMPLETE STAGE DIALOG */}
      <Modal
        open={Boolean(completeDialog)}
        onClose={() => setCompleteDialog(null)}
        title="Complete Stage"
        description={getStage(completeDialog)?.label}
      >
        <div className="order-profile__form">
          <Input
            label="Completed Quantity"
            type="number"
            min="0"
            value={completedQty}
            onChange={(event) => setCompletedQty(event.target.value)}
          />

          <Input
            label="Rejected Quantity"
            type="number"
            min="0"
            value={rejectedQty}
            onChange={(event) => setRejectedQty(event.target.value)}
          />

          <Input
            label="Wastage Quantity"
            type="number"
            min="0"
            value={wastageQty}
            onChange={(event) => setWastageQty(event.target.value)}
          />

          <Input
            label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />

          <div className="order-profile__form-actions">
            <Button
              variant="secondary"
              onClick={() => setCompleteDialog(null)}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!completedQty || submitting}
              onClick={handleComplete}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* STATUS DIALOG */}
      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change Order Status"
        description={order.orderNumber}
      >
        <div className="order-profile__form">
          <Select
            label="New Status"
            value={statusNext}
            onChange={setStatusNext}
            options={ORDER_STATUSES.map((status) => ({
              value: status.id,
              label: status.label,
            }))}
          />

          <Input
            label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />

          <div className="order-profile__form-actions">
            <Button variant="secondary" onClick={() => setStatusOpen(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!statusNext || submitting}
              onClick={handleStatusChange}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* ATTACHMENT DIALOG */}
      <Modal
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        title="Upload Attachment"
        description={order.orderNumber}
      >
        <div className="order-profile__form">
          <Select
            label="Attachment Type"
            value={attachmentType}
            onChange={setAttachmentType}
            options={ORDER_ATTACHMENT_TYPES.map((type) => ({
              value: type.id,
              label: type.label,
            }))}
          />

          <Input
            label="File Name"
            placeholder="e.g. purchase-order-1042.pdf"
            value={attachmentName}
            onChange={(event) => setAttachmentName(event.target.value)}
          />

          <Input
            label="File"
            type="file"
            onChange={(event) => setAttachmentFile(event.target.files?.[0])}
          />

          <div className="order-profile__form-actions">
            <Button
              variant="secondary"
              onClick={() => setAttachmentOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              disabled={!attachmentName.trim() || submitting}
              onClick={handleAttachmentUpload}
            >
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete order?"
        description={`This will permanently remove ${order.orderNumber} from the current ERP state.`}
        confirmLabel="Delete"
        variant="danger"
        loading={submitting}
      />
    </main>
  );
}
