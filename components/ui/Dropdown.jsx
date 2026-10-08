"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight } from "lucide-react";

import "./Dropdown.css";

const DropdownContext = createContext(null);

/*
 * Safely assigns a ref value (callback or object ref).
 * Kept at module scope so ref composition never happens
 * inside the render path of the component.
 */
function assignRef(ref, node) {
  if (typeof ref === "function") {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

function getPosition(
  triggerRect,
  menuRect,
  placement,
  offset = 6
) {
  const viewportPadding = 8;

  let top = triggerRect.bottom + offset;
  let left = triggerRect.left;

  if (placement === "bottom-end") {
    left = triggerRect.right - menuRect.width;
  }

  if (placement === "top-start") {
    top = triggerRect.top - menuRect.height - offset;
    left = triggerRect.left;
  }

  if (placement === "top-end") {
    top = triggerRect.top - menuRect.height - offset;
    left = triggerRect.right - menuRect.width;
  }

  if (
    placement.startsWith("bottom") &&
    top + menuRect.height >
      window.innerHeight - viewportPadding
  ) {
    top = triggerRect.top - menuRect.height - offset;
  }

  if (
    placement.startsWith("top") &&
    top < viewportPadding
  ) {
    top = triggerRect.bottom + offset;
  }

  if (
    left + menuRect.width >
    window.innerWidth - viewportPadding
  ) {
    left =
      window.innerWidth -
      menuRect.width -
      viewportPadding;
  }

  if (left < viewportPadding) {
    left = viewportPadding;
  }

  if (top + menuRect.height >
    window.innerHeight - viewportPadding) {
    top =
      window.innerHeight -
      menuRect.height -
      viewportPadding;
  }

  if (top < viewportPadding) {
    top = viewportPadding;
  }

  return {
    top,
    left,
  };
}

export default function Dropdown({
  children,
  trigger,
  open: controlledOpen,
  onOpenChange,
  placement = "bottom-start",
  width = 220,
  disabled = false,
  closeOnSelect = true,
  className = "",
}) {
  const id = useId();
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  /*
   * The trigger node is tracked as state instead of a ref so the
   * cloned trigger can receive a plain callback ref while still
   * exposing the node to render-safe consumers (effects read it,
   * event handlers receive it through re-renders).
   */
  const [triggerNode, setTriggerNode] = useState(null);

  const isControlled = controlledOpen !== undefined;

  const [internalOpen, setInternalOpen] =
    useState(false);

  const [position, setPosition] = useState({
    top: 0,
    left: 0,
  });

  const [activeIndex, setActiveIndex] = useState(-1);

  const open = isControlled
    ? controlledOpen
    : internalOpen;

  function setOpen(nextOpen) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  function openMenu() {
    if (disabled) return;

    setOpen(true);
    setActiveIndex(-1);
  }

  function closeMenu() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function toggleMenu() {
    if (disabled) return;

    setOpen(!open);
  }

  useLayoutEffect(() => {
    if (!open || !triggerNode || !menuRef.current) {
      return;
    }

    function updatePosition() {
      if (!triggerNode || !menuRef.current) {
        return;
      }

      const triggerRect =
        triggerNode.getBoundingClientRect();

      const menuRect =
        menuRef.current.getBoundingClientRect();

      setPosition(
        getPosition(
          triggerRect,
          menuRect,
          placement
        )
      );
    }

    updatePosition();

    window.addEventListener(
      "resize",
      updatePosition
    );

    window.addEventListener(
      "scroll",
      updatePosition,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        updatePosition
      );

      window.removeEventListener(
        "scroll",
        updatePosition,
        true
      );
    };
  }, [open, triggerNode, placement, width]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      const target = event.target;

      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        triggerNode?.focus();
        return;
      }

      const items =
        menuRef.current?.querySelectorAll(
          '[role="menuitem"]:not([aria-disabled="true"])'
        );

      if (!items?.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();

        setActiveIndex((current) => {
          const next =
            current + 1 >= items.length
              ? 0
              : current + 1;

          items[next]?.focus();

          return next;
        });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        setActiveIndex((current) => {
          const next =
            current <= 0
              ? items.length - 1
              : current - 1;

          items[next]?.focus();

          return next;
        });
      }

      if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
        setActiveIndex(0);
      }

      if (event.key === "End") {
        event.preventDefault();

        const last = items.length - 1;

        items[last]?.focus();
        setActiveIndex(last);
      }

      if (event.key === "Tab") {
        closeMenu();
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

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
  }, [open, triggerNode]);

  const triggerOriginalRef = isValidElement(trigger)
    ? trigger.props?.ref
    : null;

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        ref: (node) => {
          setTriggerNode(node);
          assignRef(triggerOriginalRef, node);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        disabled:
          disabled ||
          trigger.props.disabled,
        onClick: (event) => {
          trigger.props.onClick?.(event);

          if (!event.defaultPrevented) {
            toggleMenu();
          }
        },
        onKeyDown: (event) => {
          trigger.props.onKeyDown?.(event);

          if (event.defaultPrevented) return;

          if (
            event.key === "ArrowDown" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openMenu();
          }
        },
      })
    : (
      <button
        ref={setTriggerNode}
        type="button"
        className="af-dropdown__default-trigger"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        {trigger || "Open menu"}
      </button>
    );

  return (
    <DropdownContext.Provider
      value={{
        closeMenu,
        closeOnSelect,
        setActiveIndex,
      }}
    >
      <div
        ref={rootRef}
        className={`af-dropdown ${className}`}
      >
        {triggerElement}

        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              className="af-dropdown__portal"
              style={{
                top: position.top,
                left: position.left,
                width:
                  typeof width === "number"
                    ? `${width}px`
                    : width,
              }}
            >
              <div
                id={`${id}-menu`}
                className="af-dropdown__menu"
                role="menu"
                tabIndex={-1}
              >
                {children}
              </div>
            </div>,
            document.body
          )}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownItem({
  children,
  icon: Icon,
  description,
  shortcut,
  danger = false,
  disabled = false,
  selected = false,
  href,
  onClick,
  closeOnSelect,
  className = "",
}) {
  const context = useContext(DropdownContext);

  function handleClick(event) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    onClick?.(event);

    if (
      closeOnSelect ??
      context?.closeOnSelect ??
      true
    ) {
      context?.closeMenu();
    }
  }

  const classes = [
    "af-dropdown__item",
    danger && "af-dropdown__item--danger",
    selected && "af-dropdown__item--selected",
    disabled && "af-dropdown__item--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <a
        href={href}
        role="menuitem"
        className={classes}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
      >
        <DropdownItemContent
          Icon={Icon}
          description={description}
          shortcut={shortcut}
          selected={selected}
        >
          {children}
        </DropdownItemContent>
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={classes}
      disabled={disabled}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
    >
      <DropdownItemContent
        Icon={Icon}
        description={description}
        shortcut={shortcut}
        selected={selected}
      >
        {children}
      </DropdownItemContent>
    </button>
  );
}

function DropdownItemContent({
  Icon,
  description,
  shortcut,
  selected,
  children,
}) {
  return (
    <>
      {Icon && (
        <span className="af-dropdown__item-icon">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      )}

      <span className="af-dropdown__item-content">
        <span className="af-dropdown__item-label">
          {children}
        </span>

        {description && (
          <span className="af-dropdown__item-description">
            {description}
          </span>
        )}
      </span>

      {shortcut && (
        <span className="af-dropdown__shortcut">
          {shortcut}
        </span>
      )}

      {selected && (
        <Check
          size={15}
          className="af-dropdown__check"
        />
      )}
    </>
  );
}

export function DropdownDivider() {
  return (
    <div
      className="af-dropdown__divider"
      role="separator"
    />
  );
}

export function DropdownLabel({
  children,
}) {
  return (
    <div className="af-dropdown__label">
      {children}
    </div>
  );
}

export function DropdownSection({
  label,
  children,
}) {
  return (
    <div className="af-dropdown__section">
      {label && (
        <div className="af-dropdown__label">
          {label}
        </div>
      )}

      {children}
    </div>
  );
}

export function DropdownSubmenu({
  children,
  label,
  icon: Icon,
}) {
  return (
    <div className="af-dropdown__submenu">
      <button
        type="button"
        className="af-dropdown__item"
        role="menuitem"
      >
        {Icon && (
          <span className="af-dropdown__item-icon">
            <Icon size={16} strokeWidth={1.8} />
          </span>
        )}

        <span className="af-dropdown__item-content">
          <span className="af-dropdown__item-label">
            {label}
          </span>
        </span>

        <ChevronRight
          size={15}
          className="af-dropdown__submenu-arrow"
        />
      </button>

      <div className="af-dropdown__submenu-panel">
        {children}
      </div>
    </div>
  );
}