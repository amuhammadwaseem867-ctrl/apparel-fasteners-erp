"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  Check,
  Circle,
} from "lucide-react";

import "./ContextMenu.css";

export default function ContextMenu({
  children,
  items = [],
  disabled = false,
  className = "",
}) {
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    x: 0,
    y: 0,
  });

  const [activeIndex, setActiveIndex] = useState(0);

  function closeMenu() {
    setOpen(false);
  }

  function handleContextMenu(event) {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 230;
    const menuHeight = Math.min(
      420,
      Math.max(160, items.length * 42)
    );

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > viewportWidth - 8) {
      x = viewportWidth - menuWidth - 8;
    }

    if (y + menuHeight > viewportHeight - 8) {
      y = viewportHeight - menuHeight - 8;
    }

    x = Math.max(8, x);
    y = Math.max(8, y);

    setPosition({ x, y });
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      const enabledItems = items.filter(
        (item) =>
          item.type !== "divider" &&
          !item.disabled
      );

      if (!enabledItems.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();

        setActiveIndex((current) =>
          Math.min(current + 1, enabledItems.length - 1)
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        setActiveIndex((current) =>
          Math.max(current - 1, 0)
        );
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      }

      if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(enabledItems.length - 1);
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const item = enabledItems[activeIndex];

        if (item?.onClick) {
          item.onClick();
          closeMenu();
        }
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open, items, activeIndex]);

  const enabledItems = items.filter(
    (item) =>
      item.type !== "divider" &&
      !item.disabled
  );

  let keyboardIndex = -1;

  return (
    <div
      ref={containerRef}
      className={`af-context-menu ${className}`}
      onContextMenu={handleContextMenu}
    >
      {children}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="af-context-menu__portal"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            <div
              className="af-context-menu__menu"
              role="menu"
              aria-orientation="vertical"
            >
              {items.map((item, index) => {
                if (item.type === "divider") {
                  return (
                    <div
                      key={`divider-${index}`}
                      className="af-context-menu__divider"
                      role="separator"
                    />
                  );
                }

                if (item.type === "label") {
                  return (
                    <div
                      key={`label-${index}`}
                      className="af-context-menu__label"
                    >
                      {item.label}
                    </div>
                  );
                }

                keyboardIndex += 1;

                const currentKeyboardIndex =
                  keyboardIndex;

                const Icon = item.icon;

                const isActive =
                  currentKeyboardIndex === activeIndex;

                return (
                  <button
                    key={item.id || item.label || index}
                    type="button"
                    role="menuitem"
                    className={[
                      "af-context-menu__item",
                      isActive &&
                        "af-context-menu__item--active",
                      item.danger &&
                        "af-context-menu__item--danger",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={item.disabled}
                    onMouseEnter={() =>
                      !item.disabled &&
                      setActiveIndex(
                        currentKeyboardIndex
                      )
                    }
                    onClick={() => {
                      if (item.disabled) return;

                      item.onClick?.();
                      closeMenu();
                    }}
                  >
                    {Icon && (
                      <span className="af-context-menu__item-icon">
                        <Icon
                          size={16}
                          strokeWidth={1.8}
                        />
                      </span>
                    )}

                    <span className="af-context-menu__item-content">
                      <span className="af-context-menu__item-label">
                        {item.label}
                      </span>

                      {item.description && (
                        <span className="af-context-menu__item-description">
                          {item.description}
                        </span>
                      )}
                    </span>

                    {item.checked && (
                      <Check
                        size={15}
                        className="af-context-menu__check"
                      />
                    )}

                    {item.radio && (
                      <Circle
                        size={12}
                        className="af-context-menu__radio"
                      />
                    )}

                    {item.shortcut && (
                      <span className="af-context-menu__shortcut">
                        {item.shortcut}
                      </span>
                    )}

                    {item.submenu && (
                      <ChevronRight
                        size={15}
                        className="af-context-menu__arrow"
                      />
                    )}
                  </button>
                );
              })}

              {!items.length && (
                <div className="af-context-menu__empty">
                  No actions available
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}