"use client";

import "./PageHeader.css";

export default function PageHeader({
  title,
  description,
  eyebrow,
  action,
  children,
  className = "",
}) {
  return (
    <header className={`ui-page-header ${className}`}>
      <div className="ui-page-header__content">
        {eyebrow && (
          <span className="ui-page-header__eyebrow">
            {eyebrow}
          </span>
        )}

        <h1 className="ui-page-header__title">
          {title}
        </h1>

        {description && (
          <p className="ui-page-header__description">
            {description}
          </p>
        )}
      </div>

      {(action || children) && (
        <div className="ui-page-header__actions">
          {children}
          {action}
        </div>
      )}
    </header>
  );
}