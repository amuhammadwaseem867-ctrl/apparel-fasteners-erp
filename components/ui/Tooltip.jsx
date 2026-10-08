"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import "./Tooltip.css";

const emptySubscribe = () => () => {};

export default function Tooltip({
  children,
  content,

  side = "top",
  align = "center",

  delay = 250,
  disabled = false,

  maxWidth = 240,

  className = "",
}) {
  const tooltipId = useId();

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  /*
   * The trigger node is tracked as state so the cloned trigger can
   * receive a plain callback ref without touching ref values during
   * render.
   */
  const [triggerNode, setTriggerNode] = useState(null);

  /*
   * The pending show timer is tracked as state so the handlers cloned
   * onto the trigger never reach into a ref (which would make the
   * cloned element unsafe to create during render).
   */
  const [showTimeoutId, setShowTimeoutId] =
    useState(null);

  /*
   * Hydration-safe mounted flag: the server snapshot is false and the
   * client snapshot is true, so the tooltip only renders after
   * hydration without a setState call inside an effect.
   */
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    return () => {
      if (showTimeoutId) {
        clearTimeout(showTimeoutId);
      }
    };
  }, [showTimeoutId]);

  function showTooltip() {
    if (disabled || !content) return;

    if (showTimeoutId) {
      clearTimeout(showTimeoutId);
    }

    setShowTimeoutId(
      setTimeout(() => {
        updatePosition();
        setOpen(true);
      }, delay)
    );
  }

  function hideTooltip() {
    if (showTimeoutId) {
      clearTimeout(showTimeoutId);
    }

    setShowTimeoutId(null);
    setOpen(false);
  }

  function updatePosition() {
    const element = triggerNode;

    if (!element) return;

    const rect = element.getBoundingClientRect();

    const gap = 8;

    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top - gap;
    }

    if (side === "bottom") {
      top = rect.bottom + gap;
    }

    if (side === "left") {
      left = rect.left - gap;
    }

    if (side === "right") {
      left = rect.right + gap;
    }

    if (side === "top" || side === "bottom") {
      if (align === "start") {
        left = rect.left;
      }

      if (align === "center") {
        left = rect.left + rect.width / 2;
      }

      if (align === "end") {
        left = rect.right;
      }
    }

    if (side === "left" || side === "right") {
      if (align === "start") {
        top = rect.top;
      }

      if (align === "center") {
        top = rect.top + rect.height / 2;
      }

      if (align === "end") {
        top = rect.bottom;
      }
    }

    setPosition({
      top,
      left,
    });
  }

  useEffect(() => {
    if (!open) return;

    function handleViewportChange() {
      updatePosition();
    }

    window.addEventListener(
      "scroll",
      handleViewportChange,
      true
    );

    window.addEventListener(
      "resize",
      handleViewportChange
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleViewportChange,
        true
      );

      window.removeEventListener(
        "resize",
        handleViewportChange
      );
    };
  }, [open, side, align, triggerNode]);

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        ref: (node) => {
          setTriggerNode(node);
        },
        "aria-describedby": open
          ? tooltipId
          : undefined,
        onMouseEnter: (event) => {
          children.props?.onMouseEnter?.(event);
          showTooltip();
        },
        onMouseLeave: (event) => {
          children.props?.onMouseLeave?.(event);
          hideTooltip();
        },
        onFocus: (event) => {
          children.props?.onFocus?.(event);
          showTooltip();
        },
        onBlur: (event) => {
          children.props?.onBlur?.(event);
          hideTooltip();
        },
      })
    : children;

  const tooltip =
    open &&
    mounted &&
    position &&
    content
      ? createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className={[
              "erp-tooltip",
              `erp-tooltip--${side}`,
              `erp-tooltip--${align}`,
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              top: position.top,
              left: position.left,
              "--tooltip-max-width": `${maxWidth}px`,
            }}
          >
            {content}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {tooltip}
    </>
  );
}