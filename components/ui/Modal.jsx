"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

import "./Modal.css";
import { acquireBodyScrollLock } from "./bodyScrollLock";

const VARIANT_ICONS = {
  default: null,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export default function Modal({
  open = false,
  onClose,

  title,
  description,

  children,

  icon: Icon,
  variant = "default",

  size = "medium",

  footer,
  actions,

  showClose = true,
  closeOnOverlay = true,
  closeOnEscape = true,

  loading = false,

  className = "",
  contentClassName = "",

  ariaLabel,
}) {
  const dialogRef = useRef(null);
  const previousActiveElement =
    useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current =
      document.activeElement;

    const releaseScrollLock = acquireBodyScrollLock();
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        closeOnEscape &&
        !loading
      ) {
        onClose?.();
      }

      if (event.key === "Tab") {
        trapFocus(event);
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      cancelAnimationFrame(focusFrame);
      releaseScrollLock();

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      previousActiveElement.current?.focus?.();
    };
  }, [
    open,
    closeOnEscape,
    loading,
    onClose,
  ]);

  if (!open || !mounted) {
    return null;
  }

  function trapFocus(event) {
    const dialog = dialogRef.current;

    if (!dialog) return;

    const focusable = dialog.querySelectorAll(
      [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(",")
    );

    if (!focusable.length) return;

    const first = focusable[0];
    const last =
      focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleOverlayClick(event) {
    if (
      event.target === event.currentTarget &&
      closeOnOverlay &&
      !loading
    ) {
      onClose?.();
    }
  }

  const AutoIcon =
    Icon ||
    VARIANT_ICONS[variant] ||
    null;

  const classes = [
    "erp-modal",
    `erp-modal--${size}`,
    `erp-modal--${variant}`,
    loading
      ? "erp-modal--loading"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className="erp-modal__overlay"
      onMouseDown={handleOverlayClick}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        className={classes}
        role="dialog"
        aria-modal="true"
        aria-label={
          ariaLabel || title || "Dialog"
        }
        tabIndex={-1}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {(title ||
          description ||
          AutoIcon ||
          showClose) && (
          <header className="erp-modal__header">
            <div className="erp-modal__heading">
              {AutoIcon && (
                <div className="erp-modal__icon">
                  <AutoIcon size={18} />
                </div>
              )}

              <div className="erp-modal__heading-content">
                {title && (
                  <h2 className="erp-modal__title">
                    {title}
                  </h2>
                )}

                {description && (
                  <p className="erp-modal__description">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {showClose && (
              <button
                type="button"
                className="erp-modal__close"
                onClick={() =>
                  !loading &&
                  onClose?.()
                }
                disabled={loading}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}

        <div
          className={[
            "erp-modal__body",
            contentClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>

        {(footer || actions) && (
          <footer className="erp-modal__footer">
            {footer || actions}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/* =========================================
   MODAL ACTION
========================================= */

export function ModalAction({
  children,
  variant = "secondary",
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
}) {
  return (
    <button
      type={type}
      className={`erp-modal-action erp-modal-action--${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && (
        <span className="erp-modal-action__spinner" />
      )}

      {!loading && Icon && (
        <Icon size={15} />
      )}

      <span>{children}</span>
    </button>
  );
}

/* =========================================
   CONFIRM MODAL
========================================= */

export function ConfirmModal({
  open,
  onClose,

  title = "Confirm action",
  description = "Are you sure you want to continue?",

  confirmLabel = "Confirm",
  cancelLabel = "Cancel",

  onConfirm,

  variant = "warning",

  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      variant={variant}
      size="small"
      closeOnOverlay={!loading}
      closeOnEscape={!loading}
      loading={loading}
      footer={
        <div className="erp-modal__actions">
          <ModalAction
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </ModalAction>

          <ModalAction
            variant={
              variant === "danger"
                ? "danger"
                : "primary"
            }
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </ModalAction>
        </div>
      }
    >
      <div className="erp-confirm">
        <p className="erp-confirm__text">
          This action may affect related
          records and workflow history.
          Please verify before continuing.
        </p>
      </div>
    </Modal>
  );
}