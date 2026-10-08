"use client";

import Avatar from "./Avatar";

import "./AvatarGroup.css";

export default function AvatarGroup({
  items = [],
  max = 5,
  size = "medium",
  spacing = "overlap",
  bordered = true,
  showTooltip = true,
  className = "",
}) {
  const visibleItems = items.slice(0, max);
  const remaining = Math.max(
    0,
    items.length - max
  );

  return (
    <div
      className={[
        "avatar-group",
        `avatar-group--${size}`,
        `avatar-group--${spacing}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${items.length} people`}
    >
      {visibleItems.map((item, index) => (
        <span
          className="avatar-group__item"
          key={
            item.id ??
            item.email ??
            `${item.name}-${index}`
          }
          style={{
            zIndex: visibleItems.length - index,
          }}
        >
          <Avatar
            src={item.src}
            name={item.name}
            alt={item.name}
            size={size}
            variant={item.variant || "default"}
            status={item.status}
            bordered={bordered}
          />

          {showTooltip && item.name && (
            <span className="avatar-group__tooltip">
              {item.name}
            </span>
          )}
        </span>
      ))}

      {remaining > 0 && (
        <span
          className="avatar-group__more"
          title={`${remaining} more`}
          aria-label={`${remaining} more people`}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

export function ApprovalAvatars({
  approvers = [],
  max = 4,
  size = "small",
  className = "",
}) {
  return (
    <AvatarGroup
      items={approvers}
      max={max}
      size={size}
      spacing="overlap"
      bordered
      className={className}
    />
  );
}