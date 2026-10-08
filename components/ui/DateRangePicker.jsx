"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import "./DateRangePicker.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const QUICK_RANGES = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "Last 7 days", key: "7days" },
  { label: "Last 30 days", key: "30days" },
  { label: "This month", key: "month" },
  { label: "Last month", key: "last-month" },
];

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  if (!date) return "";

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function displayDate(date) {
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDays(month) {
  const first = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  );

  const mondayIndex =
    (first.getDay() + 6) % 7;

  const start = new Date(first);

  start.setDate(
    first.getDate() - mondayIndex
  );

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);

    date.setDate(start.getDate() + i);

    return date;
  });
}

function normalizeRange(range) {
  if (!range) {
    return {
      start: null,
      end: null,
    };
  }

  return {
    start: toDate(range.start),
    end: toDate(range.end),
  };
}

function getQuickRange(key) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  if (key === "today") {
    return {
      start: new Date(today),
      end: new Date(today),
    };
  }

  if (key === "yesterday") {
    const yesterday = new Date(today);

    yesterday.setDate(
      yesterday.getDate() - 1
    );

    return {
      start: yesterday,
      end: yesterday,
    };
  }

  if (key === "7days") {
    const start = new Date(today);

    start.setDate(start.getDate() - 6);

    return {
      start,
      end: new Date(today),
    };
  }

  if (key === "30days") {
    const start = new Date(today);

    start.setDate(start.getDate() - 29);

    return {
      start,
      end: new Date(today),
    };
  }

  if (key === "month") {
    return {
      start: new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      ),
      end: new Date(today),
    };
  }

  if (key === "last-month") {
    return {
      start: new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      ),
      end: new Date(
        today.getFullYear(),
        today.getMonth(),
        0
      ),
    };
  }

  return {
    start: null,
    end: null,
  };
}

export default function DateRangePicker({
  value,
  defaultValue,
  onChange,
  label,
  description,
  error,
  required = false,
  placeholder = "Select date range",
  size = "medium",
  clearable = true,
  disabled = false,
  fullWidth = true,
  showQuickRanges = true,
  className = "",
}) {
  const controlled =
    value !== undefined;

  const [internalValue, setInternalValue] =
    useState(() =>
      normalizeRange(defaultValue)
    );

  const range = controlled
    ? normalizeRange(value)
    : internalValue;
  const hasRangeStart = Boolean(range.start);

  const [open, setOpen] = useState(false);

  const [viewMonth, setViewMonth] =
    useState(() =>
      range.start || new Date(2000, 0, 1)
    );

  const [todayKey, setTodayKey] = useState("");

  const [selectingStart, setSelectingStart] =
    useState(true);

  const days = useMemo(
    () => getDays(viewMonth),
    [viewMonth]
  );

  useEffect(() => {
    const updateToday = () => {
      const today = new Date();
      setTodayKey(formatDate(today));

      if (!hasRangeStart) {
        setViewMonth(today);
      }
    };

    updateToday();

    const timer = window.setInterval(updateToday, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [hasRangeStart]);

  function emitRange(nextRange) {
    if (!controlled) {
      setInternalValue(nextRange);
    }

    onChange?.(nextRange, {
      start: formatDate(nextRange.start),
      end: formatDate(nextRange.end),
    });
  }

  function selectDate(date) {
    if (selectingStart || !range.start) {
      emitRange({
        start: date,
        end: null,
      });

      setSelectingStart(false);
      return;
    }

    if (date < range.start) {
      emitRange({
        start: date,
        end: range.start,
      });
    } else {
      emitRange({
        start: range.start,
        end: date,
      });
    }

    setSelectingStart(true);
    setOpen(false);
  }

  function clearRange(event) {
    event.stopPropagation();

    emitRange({
      start: null,
      end: null,
    });

    setSelectingStart(true);
  }

  function previousMonth() {
    setViewMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );
  }

  function nextMonth() {
    setViewMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );
  }

  function applyQuickRange(key) {
    const nextRange = getQuickRange(key);

    emitRange(nextRange);

    setViewMonth(
      nextRange.start || new Date()
    );

    setSelectingStart(true);
    setOpen(false);
  }

  const hasRange =
    range.start || range.end;

  const rangeLabel =
    range.start && range.end
      ? `${displayDate(range.start)} – ${displayDate(
          range.end
        )}`
      : range.start
        ? `${displayDate(range.start)} – Select end`
        : placeholder;

  return (
    <div
      className={[
        "date-range-picker",
        fullWidth
          ? "date-range-picker--full"
          : "",
        `date-range-picker--${size}`,
        open
          ? "date-range-picker--open"
          : "",
        error
          ? "date-range-picker--error"
          : "",
        disabled
          ? "date-range-picker--disabled"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label className="date-range-picker__label">
          {label}

          {required && (
            <span className="date-range-picker__required">
              *
            </span>
          )}
        </label>
      )}

      {description && !error && (
        <div className="date-range-picker__description">
          {description}
        </div>
      )}

      <button
        type="button"
        className="date-range-picker__trigger"
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
      >
        <CalendarDays size={17} />

        <span
          className={
            !hasRange
              ? "date-range-picker__placeholder"
              : ""
          }
        >
          {rangeLabel}
        </span>

        {hasRange && clearable && (
          <span
            className="date-range-picker__clear"
            onClick={clearRange}
            role="button"
            aria-label="Clear date range"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {error && (
        <div className="date-range-picker__error">
          {error}
        </div>
      )}

      {open && (
        <div className="date-range-picker__popover">
          {showQuickRanges && (
            <div className="date-range-picker__quick">
              <div className="date-range-picker__quick-title">
                Quick ranges
              </div>

              {QUICK_RANGES.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() =>
                    applyQuickRange(item.key)
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="date-range-picker__calendar">
            <div className="date-range-picker__header">
              <button
                type="button"
                onClick={previousMonth}
                aria-label="Previous month"
              >
                <ChevronLeft size={17} />
              </button>

              <strong>
                {MONTHS[viewMonth.getMonth()]}{" "}
                {viewMonth.getFullYear()}
              </strong>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <div className="date-range-picker__weekdays">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="date-range-picker__grid">
              {days.map((date) => {
                const outside =
                  date.getMonth() !==
                  viewMonth.getMonth();

                const selectedStart =
                  sameDay(date, range.start);

                const selectedEnd =
                  sameDay(date, range.end);

                const inRange =
                  range.start &&
                  range.end &&
                  date >= range.start &&
                  date <= range.end;

                return (
                  <button
                    type="button"
                    key={date.toISOString()}
                    className={[
                      "date-range-picker__day",
                      outside
                        ? "date-range-picker__day--outside"
                        : "",
                      selectedStart
                        ? "date-range-picker__day--start"
                        : "",
                      selectedEnd
                        ? "date-range-picker__day--end"
                        : "",
                      inRange
                        ? "date-range-picker__day--range"
                        : "",
                      todayKey === formatDate(date)
                        ? "date-range-picker__day--today"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      selectDate(date)
                    }
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="date-range-picker__footer">
              <span>
                {selectingStart
                  ? "Select start date"
                  : "Select end date"}
              </span>

              <span>
                {range.start
                  ? formatDate(range.start)
                  : "YYYY-MM-DD"}
                {" → "}
                {range.end
                  ? formatDate(range.end)
                  : "YYYY-MM-DD"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}