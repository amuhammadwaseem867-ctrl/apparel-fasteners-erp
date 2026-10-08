"use client";

import { useId } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
} from "lucide-react";

import Modal from "./Modal";

const ICONS = {
  danger: CircleAlert,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

export default function ConfirmDialog({
  open = false,
  onClose,
  onConfirm,

  title = "Are you sure?",
  description,

  confirmLabel = "Confirm",
  cancelLabel = "Cancel",

  variant = "danger",

  loading = false,
  disabled = false,

  requireText = false,
  confirmationText = "",
  onConfirmationTextChange,
  expectedText = "CONFIRM",

  children,
}) {
  const confirmationInputId = useId();
  const Icon =
    ICONS[variant] || CircleAlert;

  const isTextValid =
    !requireText ||
    confirmationText.trim() ===
      expectedText;

  const canConfirm =
    !loading &&
    !disabled &&
    isTextValid;

  function handleConfirm() {
    if (!canConfirm) return;

    onConfirm?.();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) {
          onClose?.();
        }
      }}
      size="small"
      closeOnOverlay={!loading}
      closeOnEscape={!loading}
      showClose={!loading}
    >
      <div className="erp-confirm-dialog">
        <div
          className={`erp-confirm-dialog__icon erp-confirm-dialog__icon--${variant}`}
        >
          <Icon size={22} />
        </div>

        <div className="erp-confirm-dialog__content">
          <h2 className="erp-confirm-dialog__title">
            {title}
          </h2>

          {description && (
            <p className="erp-confirm-dialog__description">
              {description}
            </p>
          )}

          {children}

          {requireText && (
            <div className="erp-confirm-dialog__verification">
              <label
                htmlFor={confirmationInputId}
                className="erp-confirm-dialog__label"
              >
                Type{" "}
                <strong>
                  {expectedText}
                </strong>{" "}
                to continue
              </label>

              <input
                id={confirmationInputId}
                type="text"
                value={confirmationText}
                onChange={(event) =>
                  onConfirmationTextChange?.(
                    event.target.value
                  )
                }
                autoComplete="off"
                spellCheck={false}
                className="erp-confirm-dialog__input"
              />
            </div>
          )}
        </div>

        <div className="erp-confirm-dialog__actions">
          <button
            type="button"
            className="erp-confirm-dialog__cancel"
            disabled={loading}
            onClick={onClose}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`erp-confirm-dialog__confirm erp-confirm-dialog__confirm--${variant}`}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {loading && (
              <Loader2
                size={15}
                className="erp-confirm-dialog__spinner"
              />
            )}

            {loading
              ? "Processing..."
              : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}