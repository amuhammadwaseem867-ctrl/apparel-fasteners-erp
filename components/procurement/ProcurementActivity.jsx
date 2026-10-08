"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileCheck,
  FileText,
  PackageCheck,
  ShoppingCart,
  UserRound,
} from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementActivity.css";

const iconMap = {
  requisition: ClipboardList,
  rfq: FileText,
  quote: FileCheck,
  purchase_order: ShoppingCart,
  goods_receipt: PackageCheck,
  supplier: UserRound,
};

export default function ProcurementActivity({
  activities = [],
  title = "Recent Procurement Activity",
  description = "Latest procurement events and supplier interactions.",
  href = "/procurement",
  className = "",
}) {
  return (
    <Card
      title={title}
      description={description}
      className={`procurement-activity-card ${className}`}
      action={
        href ? (
          <Link
            href={href}
            className="procurement-activity__view-all"
          >
            View all
            <ArrowRight size={13} />
          </Link>
        ) : null
      }
    >
      {activities.length === 0 ? (
        <div className="procurement-activity__empty">
          <div className="procurement-activity__empty-icon">
            <ClipboardList size={19} strokeWidth={1.7} />
          </div>

          <strong>No procurement activity yet</strong>

          <p>
            Requisitions, RFQs, supplier quotes, purchase orders and goods
            receipts will appear here once transactions are connected.
          </p>
        </div>
      ) : (
        <div className="procurement-activity">
          {activities.map((activity, index) => {
            const Icon =
              activity.icon ||
              iconMap[activity.type] ||
              ClipboardList;

            const content = (
              <>
                <div
                  className={`procurement-activity__icon procurement-activity__icon--${
                    activity.tone || "default"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </div>

                <div className="procurement-activity__content">
                  <div className="procurement-activity__top">
                    <strong>
                      {activity.title || "Procurement activity"}
                    </strong>

                    {activity.time && (
                      <time>{activity.time}</time>
                    )}
                  </div>

                  {activity.description && (
                    <p>{activity.description}</p>
                  )}

                  {(activity.reference || activity.supplier) && (
                    <div className="procurement-activity__meta">
                      {activity.reference && (
                        <span>{activity.reference}</span>
                      )}

                      {activity.supplier && (
                        <span>{activity.supplier}</span>
                      )}
                    </div>
                  )}

                  {activity.status && (
                    <span
                      className={`procurement-activity__status procurement-activity__status--${
                        activity.statusTone || "neutral"
                      }`}
                    >
                      {activity.status}
                    </span>
                  )}
                </div>

                {activity.href && (
                  <ArrowRight
                    className="procurement-activity__arrow"
                    size={15}
                  />
                )}
              </>
            );

            if (activity.href) {
              return (
                <Link
                  key={activity.id || index}
                  href={activity.href}
                  className="procurement-activity__item"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={activity.id || index}
                className="procurement-activity__item"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}