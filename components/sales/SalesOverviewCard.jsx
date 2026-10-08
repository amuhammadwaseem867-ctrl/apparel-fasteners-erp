"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import "./SalesOverviewCard.css";

export default function SalesOverviewCard({
  label,
  value = 0,
  description,
  icon: Icon,
  href,
  trend,
  trendType = "neutral",
}) {
  const hasTrend = trend !== undefined && trend !== null;

  return (
    <article className="sales-overview-card">
      <div className="sales-overview-card__top">
        <div className="sales-overview-card__icon" aria-hidden="true">
          {Icon ? (
            <Icon
              size={18}
              strokeWidth={1.8}
            />
          ) : null}
        </div>

        {href ? (
          <Link
            href={href}
            className="sales-overview-card__link"
            aria-label={`Open ${label}`}
          >
            <ArrowUpRight
              size={15}
              strokeWidth={1.8}
            />
          </Link>
        ) : null}
      </div>

      <div className="sales-overview-card__content">
        <span className="sales-overview-card__label">
          {label}
        </span>

        <strong className="sales-overview-card__value">
          {value}
        </strong>

        {description ? (
          <span className="sales-overview-card__description">
            {description}
          </span>
        ) : null}
      </div>

      {hasTrend ? (
        <div
          className={`sales-overview-card__trend sales-overview-card__trend--${trendType}`}
        >
          {trend}
        </div>
      ) : null}
    </article>
  );
}