"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import "./Drawer.css";
import { acquireBodyScrollLock } from "./bodyScrollLock";

const emptySubscribe = () => () => {};

export default function Drawer({
  open = false,
  onClose,

  title,
  description,
  eyebrow,

  children,

  footer,
  actions,

  side = "right",
  size = "medium",

  closeOnOverlay = true,
  closeOnEscape = true,

  showClose = true,

  loading = false,

  className = "",
  overlayClassName = "",

  ariaLabel,
}) {
  const drawerRef = useRef(null);
  const previousActiveElement =
    useRef(null);

  /*
   * Hydration-safe mounted flag: false on the server and true on the
   * client, so the drawer only renders after hydration without a
   * setState call inside an effect.
   */
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current =
      document.activeElement;

    const releaseScrollLock = acquireBodyScrollLock();

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        closeOnEscape &&
        !loading
      ) {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") return;

      const drawer =
        drawerRef.current;

      if (!drawer) return;

      const focusable = drawer.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    const focusFrame = requestAnimationFrame(() => {
      const firstFocusable =
        drawerRef.current?.querySelector(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
        );

      firstFocusable?.focus();
    });

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

  if (!open || !mounted) return null;

  const drawerClasses = [
    "erp-drawer",
    `erp-drawer--${side}`,
    `erp-drawer--${size}`,
    loading
      ? "erp-drawer--loading"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const overlayClasses = [
    "erp-drawer__overlay",
    overlayClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div
      className="erp-drawer-root"
      data-side={side}
    >
      <button
        type="button"
        className={overlayClasses}
        aria-label="Close drawer"
        onClick={() => {
          if (
            closeOnOverlay &&
            !loading
          ) {
            onClose?.();
          }
        }}
      />

      <aside
        ref={drawerRef}
        className={drawerClasses}
        role="dialog"
        aria-modal="true"
        aria-label={
          ariaLabel || title || "Drawer"
        }
      >
        <header className="erp-drawer__header">
          <div className="erp-drawer__heading">
            {eyebrow && (
              <div className="erp-drawer__eyebrow">
                {eyebrow}
              </div>
            )}

            {title && (
              <h2 className="erp-drawer__title">
                {title}
              </h2>
            )}

            {description && (
              <p className="erp-drawer__description">
                {description}
              </p>
            )}
          </div>

          {showClose && (
            <button
              type="button"
              className="erp-drawer__close"
              aria-label="Close drawer"
              disabled={loading}
              onClick={() =>
                onClose?.()
              }
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div className="erp-drawer__body">
          {children}
        </div>

        {(footer || actions) && (
          <footer className="erp-drawer__footer">
            {footer}

            {actions && (
              <div className="erp-drawer__actions">
                {actions}
              </div>
            )}
          </footer>
        )}

        {loading && (
          <div
            className="erp-drawer__loading"
            aria-label="Loading"
          >
            <span />
          </div>
        )}
      </aside>
    </div>
  );

  return createPortal(
    content,
    document.body
  );
}