"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import "./Tabs.css";

export default function Tabs({
  tabs = [],
  activeTab,
  defaultTab,
  onChange,

  variant = "line",
  size = "medium",

  fullWidth = false,
  scrollable = true,

  className = "",
}) {
  const generatedId = useId();

  const initialTab =
    activeTab ??
    defaultTab ??
    tabs.find((tab) => !tab.disabled)?.value ??
    tabs[0]?.value;

  const [internalTab, setInternalTab] =
    useState(initialTab);

  const currentTab =
    activeTab !== undefined
      ? activeTab
      : internalTab;

  useEffect(() => {
    if (
      currentTab &&
      tabs.some((tab) => tab.value === currentTab)
    ) {
      return;
    }

    const fallback = tabs.find(
      (tab) => !tab.disabled
    )?.value;

    if (fallback) {
      setInternalTab(fallback);
    }
  }, [tabs, currentTab]);

  function handleChange(tab) {
    if (tab.disabled) return;

    if (activeTab === undefined) {
      setInternalTab(tab.value);
    }

    onChange?.(tab.value, tab);
  }

  function handleKeyDown(event, index) {
    const enabledTabs = tabs.filter(
      (tab) => !tab.disabled
    );

    if (!enabledTabs.length) return;

    let nextIndex = -1;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % enabledTabs.length;
    }

    if (event.key === "ArrowLeft") {
      nextIndex =
        (index - 1 + enabledTabs.length) %
        enabledTabs.length;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = enabledTabs.length - 1;
    }

    if (nextIndex === -1) return;

    event.preventDefault();

    const nextTab = enabledTabs[nextIndex];

    handleChange(nextTab);

    document
      .getElementById(
        `erp-tab-${generatedId}-${nextTab.value}`
      )
      ?.focus();
  }

  const classes = [
    "erp-tabs",
    `erp-tabs--${variant}`,
    `erp-tabs--${size}`,
    fullWidth
      ? "erp-tabs--full-width"
      : "",
    scrollable
      ? "erp-tabs--scrollable"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div
        className="erp-tabs__list"
        role="tablist"
        aria-orientation="horizontal"
      >
        {tabs.map((tab, index) => {
          const isActive =
            currentTab === tab.value;

          const Icon = tab.icon;

          const tabContent = (
            <>
              {Icon && (
                <Icon
                  className="erp-tabs__icon"
                  size={15}
                  strokeWidth={1.8}
                />
              )}

              <span className="erp-tabs__label">
                {tab.label}
              </span>

              {tab.count !== undefined &&
                tab.count !== null && (
                  <span
                    className={[
                      "erp-tabs__count",
                      isActive
                        ? "erp-tabs__count--active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {tab.count}
                  </span>
                )}

              {tab.badge && (
                <span className="erp-tabs__badge">
                  {tab.badge}
                </span>
              )}
            </>
          );

          const commonProps = {
            id: `erp-tab-${generatedId}-${tab.value}`,
            className: [
              "erp-tabs__tab",
              isActive
                ? "erp-tabs__tab--active"
                : "",
              tab.disabled
                ? "erp-tabs__tab--disabled"
                : "",
            ]
              .filter(Boolean)
              .join(" "),
            role: "tab",
            "aria-selected": isActive,
            "aria-controls": `erp-panel-${generatedId}-${tab.value}`,
            tabIndex: isActive ? 0 : -1,
            disabled: tab.disabled,
            onKeyDown: (event) =>
              handleKeyDown(event, index),
            onClick: () =>
              handleChange(tab),
          };

          if (tab.href && !tab.disabled) {
            return (
              <Link
                key={tab.value}
                href={tab.href}
                {...commonProps}
                onClick={(event) => {
                  tab.onClick?.(event);
                  handleChange(tab);
                }}
              >
                {tabContent}
              </Link>
            );
          }

          return (
            <button
              key={tab.value}
              type="button"
              {...commonProps}
            >
              {tabContent}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({
  value,
  activeTab,
  children,
  keepMounted = false,
  className = "",
}) {
  const generatedId = useId();

  const active = value === activeTab;

  if (!active && !keepMounted) {
    return null;
  }

  return (
    <section
      id={`erp-panel-${generatedId}-${value}`}
      className={[
        "erp-tab-panel",
        active
          ? "erp-tab-panel--active"
          : "erp-tab-panel--hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="tabpanel"
      hidden={!active}
      tabIndex={0}
    >
      {children}
    </section>
  );
}