"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import "./Tooltip.css";

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
  const triggerRef = useRef(null);
  const timeoutRef = useRef(null);
  const tooltipId = useId();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    setMounted(true);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function showTooltip() {
    if (disabled || !content) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, delay);
  }

  function hideTooltip() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setOpen(false);
  }

  function updatePosition() {
    const element = triggerRef.current;

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
  }, [open, side, align]);

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        ref: triggerRef,
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