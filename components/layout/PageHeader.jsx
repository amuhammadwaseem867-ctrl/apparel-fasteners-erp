"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

import Breadcrumbs from "./Breadcrumbs";

import "./PageHeader.css";

export default function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  showBreadcrumbs = true,
  backHref,
  backLabel = "Back",
  actions,
  meta,
  children,
  className = "",
}) {
  return (
    <header
      className={`erp-page-header ${className}`}
    >
      <div className="erp-page-header__top">
        <div className="erp-page-header__heading">
          {showBreadcrumbs && (
            <Breadcrumbs
              items={breadcrumbs}
              className="erp-page-header__breadcrumbs"
            />
          )}

          {backHref && (
            <Link
              href={backHref}
              className="erp-page-header__back"
            >
              <ArrowLeft size={15} />
              <span>{backLabel}</span>
            </Link>
          )}

          {eyebrow && (
            <div className="erp-page-header__eyebrow">
              {eyebrow}
            </div>
          )}

          <div className="erp-page-header__title-row">
            <h1 className="erp-page-header__title">
              {title}
            </h1>

            {meta && (
              <div className="erp-page-header__meta">
                {meta}
              </div>
            )}
          </div>

          {description && (
            <p className="erp-page-header__description">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="erp-page-header__actions">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="erp-page-header__bottom">
          {children}
        </div>
      )}
    </header>
  );
}

/* =========================================
   REUSABLE PAGE ACTION
========================================= */

export function PageHeaderAction({
  children,
  href,
  icon: Icon,
  variant = "secondary",
  size = "medium",
  onClick,
  disabled = false,
  type = "button",
  className = "",
}) {
  const classes = [
    "erp-page-header__action",
    `erp-page-header__action--${variant}`,
    `erp-page-header__action--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {Icon && <Icon size={16} strokeWidth={2} />}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}

/* =========================================
   PAGE HEADER ACTION GROUP
========================================= */

export function PageHeaderActions({
  children,
  className = "",
}) {
  return (
    <div
      className={`erp-page-header__action-group ${className}`}
    >
      {children}
    </div>
  );
}

/* =========================================
   PAGE HEADER TABS
========================================= */

export function PageHeaderTabs({
  items = [],
  active,
  onChange,
  className = "",
}) {
  return (
    <div
      className={`erp-page-header__tabs ${className}`}
    >
      {items.map((item) => {
        const isActive =
          active === item.value;

        return (
          <button
            key={item.value}
            type="button"
            className={`erp-page-header__tab ${
              isActive
                ? "erp-page-header__tab--active"
                : ""
            }`}
            onClick={() =>
              onChange?.(item.value)
            }
          >
            {item.icon && (
              <item.icon size={15} />
            )}

            <span>{item.label}</span>

            {item.count !== undefined && (
              <span className="erp-page-header__tab-count">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================
   STATUS
========================================= */

export function PageHeaderStatus({
  children,
  variant = "neutral",
}) {
  return (
    <span
      className={`erp-page-header__status erp-page-header__status--${variant}`}
    >
      <span className="erp-page-header__status-dot" />
      {children}
    </span>
  );
}