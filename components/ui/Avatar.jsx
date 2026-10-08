"use client";

import { useMemo } from "react";
import { UserRound } from "lucide-react";

import "./Avatar.css";

function getInitials(name = "") {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "U";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export default function Avatar({
  src,
  alt = "",
  name = "",
  size = "medium",
  shape = "circle",
  variant = "default",
  status,
  statusLabel,
  bordered = false,
  fallbackIcon = false,
  className = "",
}) {
  const initials = useMemo(
    () => getInitials(name),
    [name]
  );

  return (
    <span
      className={[
        "avatar",
        `avatar--${size}`,
        `avatar--${shape}`,
        `avatar--${variant}`,
        bordered ? "avatar--bordered" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={name || undefined}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || "User"}
          className="avatar__image"
        />
      ) : fallbackIcon ? (
        <UserRound
          className="avatar__icon"
          aria-hidden="true"
        />
      ) : (
        <span className="avatar__initials">
          {initials}
        </span>
      )}

      {status && (
        <span
          className={`avatar__status avatar__status--${status}`}
          aria-label={statusLabel || status}
          title={statusLabel || status}
        />
      )}
    </span>
  );
}

export function UserAvatar({
  name,
  src,
  status,
  size = "medium",
  ...props
}) {
  return (
    <Avatar
      name={name}
      src={src}
      status={status}
      size={size}
      {...props}
    />
  );
}

export function EmployeeAvatar({
  name,
  src,
  status,
  size = "medium",
  ...props
}) {
  return (
    <Avatar
      name={name}
      src={src}
      status={status}
      size={size}
      variant="employee"
      {...props}
    />
  );
}