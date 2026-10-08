"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  X,
  AlertTriangle,
  Clock3,
  ArrowRight,
} from "lucide-react";

import "./NotificationCenter.css";

/*
 * Notifications are provided by the caller (backend once
 * connected). Default is an empty set — no mock data.
 *
 * Notification shape:
 * { id, type, title, description, time, unread, icon, tone, href }
 */
const DEFAULT_NOTIFICATIONS = [];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "approval", label: "Approvals" },
  { value: "inventory", label: "Inventory" },
  { value: "production", label: "Production" },
  { value: "quality", label: "Quality" },
  { value: "finance", label: "Finance" },
  { value: "dispatch", label: "Dispatch" },
];

export default function NotificationCenter({
  open = false,
  onClose,
  onSelect,
  notifications = DEFAULT_NOTIFICATIONS,
  onMarkAllRead,
}) {
  const panelRef = useRef(null);
  const router = useRouter();

  const [items, setItems] = useState(notifications);
  const [filter, setFilter] = useState("all");

  /*
   * Keep the local copy in sync with the incoming notifications prop.
   * This runs during render (adjusting state derived from props)
   * instead of inside an effect.
   */
  const [previousNotifications, setPreviousNotifications] =
    useState(notifications);

  if (notifications !== previousNotifications) {
    setPreviousNotifications(notifications);
    setItems(notifications);
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyboard(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        onClose?.();
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );
    };
  }, [open, onClose]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.unread).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (filter === "all") {
      return items;
    }

    if (filter === "unread") {
      return items.filter((item) => item.unread);
    }

    return items.filter((item) => item.type === filter);
  }, [items, filter]);

  function markAsRead(id) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, unread: false }
          : item
      )
    );
  }

  function markAllRead() {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      }))
    );

    onMarkAllRead?.();
  }

  function handleSelect(item) {
    markAsRead(item.id);

    onSelect?.(item);

    if (!onSelect && item.href) {
      router.push(item.href);
    }

    onClose?.();
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="notification-center">
      <div
        ref={panelRef}
        className="notification-center__panel"
        role="dialog"
        aria-label="Notifications"
      >
        <div className="notification-center__header">
          <div>
            <div className="notification-center__title-row">
              <h2>Notifications</h2>

              {unreadCount > 0 && (
                <span className="notification-center__count">
                  {unreadCount}
                </span>
              )}
            </div>

            <p>
              Alerts and activity requiring your attention
            </p>
          </div>

          <button
            type="button"
            className="notification-center__close"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X size={17} />
          </button>
        </div>

        <div className="notification-center__toolbar">
          <div className="notification-center__filters">
            {FILTERS.map((item) => {
              const active = filter === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  className={`notification-center__filter ${
                    active
                      ? "notification-center__filter--active"
                      : ""
                  }`}
                  onClick={() =>
                    setFilter(item.value)
                  }
                >
                  {item.label}

                  {item.value === "unread" &&
                    unreadCount > 0 && (
                      <span>
                        {unreadCount}
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="notification-center__mark-all"
              onClick={markAllRead}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        <div className="notification-center__body">
          {filteredItems.length === 0 ? (
            <div className="notification-center__empty">
              <div className="notification-center__empty-icon">
                <Bell size={22} />
              </div>

              <strong>
                No notifications
              </strong>

              <span>
                There are no notifications in this view.
              </span>
            </div>
          ) : (
            <div className="notification-center__list">
              {filteredItems.map((item) => {
                const Icon = item.icon || Bell;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`notification-center__item ${
                      item.unread
                        ? "notification-center__item--unread"
                        : ""
                    }`}
                    onClick={() =>
                      handleSelect(item)
                    }
                  >
                    <span
                      className={`notification-center__item-icon notification-center__item-icon--${item.tone}`}
                    >
                      <Icon
                        size={17}
                        strokeWidth={2}
                      />
                    </span>

                    <span className="notification-center__item-content">
                      <span className="notification-center__item-title">
                        {item.title}
                      </span>

                      <span className="notification-center__item-description">
                        {item.description}
                      </span>

                      <span className="notification-center__item-time">
                        <Clock3 size={12} />
                        {item.time}
                      </span>
                    </span>

                    <span className="notification-center__item-side">
                      {item.unread && (
                        <span className="notification-center__unread-dot" />
                      )}

                      <ArrowRight
                        size={15}
                        className="notification-center__arrow"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="notification-center__footer">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              router.push("/administration/settings");
            }}
          >
            View notification settings
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}