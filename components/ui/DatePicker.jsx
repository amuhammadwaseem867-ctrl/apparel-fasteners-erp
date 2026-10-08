"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import "./DatePicker.css";

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

function pad(value) {
  return String(value).padStart(2, "0");
}

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

function isSameDay(a, b) {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function getCalendarDays(month) {
  const firstDay = startOfMonth(month);

  // Monday = 0
  const mondayIndex =
    (firstDay.getDay() + 6) % 7;

  const start = new Date(firstDay);
  start.setDate(
    firstDay.getDate() - mondayIndex
  );

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function DatePicker({
  value,
  defaultValue,
  onChange,
  label,
  description,
  error,
  required = false,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled = false,
  clearable = true,
  size = "medium",
  fullWidth = true,
  className = "",
}) {
  const rootRef = useRef(null);

  const controlled =
    value !== undefined;

  const [internalValue, setInternalValue] =
    useState(() => toDate(defaultValue));

  const selectedDate = useMemo(
    () => (controlled ? toDate(value) : internalValue),
    [controlled, value, internalValue]
  );
  const selectedDateKey = selectedDate
    ? formatDate(selectedDate)
    : "";

  const [open, setOpen] = useState(false);

  const [viewDate, setViewDate] = useState(
    () => selectedDate || new Date(2000, 0, 1)
  );

  const [todayKey, setTodayKey] = useState("");

  /*
   * Follow the selected date during render (adjusting state derived
   * from the selected value) instead of synchronizing the view date
   * inside an effect.
   */
  const [previousSelectedDateKey, setPreviousSelectedDateKey] =
    useState(selectedDateKey);

  if (selectedDateKey !== previousSelectedDateKey) {
    setPreviousSelectedDateKey(selectedDateKey);

    if (selectedDateKey) {
      const [year, month, day] = selectedDateKey
        .split("-")
        .map(Number);

      setViewDate(new Date(year, month - 1, day));
    }
  }

  useEffect(() => {
    const updateToday = () => {
      const today = new Date();
      setTodayKey(formatDate(today));

      if (!selectedDateKey) {
        setViewDate(today);
      }
    };

    updateToday();

    const timer = window.setInterval(updateToday, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [selectedDateKey]);

  useEffect(() => {
    function handleOutside(event) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  const calendarDays = useMemo(
    () => getCalendarDays(viewDate),
    [viewDate]
  );

  const minimum = toDate(minDate);
  const maximum = toDate(maxDate);

  function isDisabled(date) {
    if (minimum && date < minimum) {
      return true;
    }

    if (maximum && date > maximum) {
      return true;
    }

    return false;
  }

  function selectDate(date) {
    if (isDisabled(date)) return;

    if (!controlled) {
      setInternalValue(date);
    }

    onChange?.(date, formatDate(date));
    setOpen(false);
  }

  function clearDate(event) {
    event.stopPropagation();

    if (!controlled) {
      setInternalValue(null);
    }

    onChange?.(null, "");
  }

  function previousMonth() {
    setViewDate(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );
  }

  function nextMonth() {
    setViewDate(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );
  }

  function goToday() {
    const today = new Date();
    setTodayKey(formatDate(today));
    setViewDate(today);

    if (!isDisabled(today)) {
      selectDate(today);
    }
  }

  return (
    <div
      ref={rootRef}
      className={[
        "date-picker",
        fullWidth ? "date-picker--full" : "",
        `date-picker--${size}`,
        open ? "date-picker--open" : "",
        error ? "date-picker--error" : "",
        disabled ? "date-picker--disabled" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label className="date-picker__label">
          {label}

          {required && (
            <span
              className="date-picker__required"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}

      {description && !error && (
        <div className="date-picker__description">
          {description}
        </div>
      )}

      <button
        type="button"
        className="date-picker__trigger"
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays
          className="date-picker__calendar-icon"
          size={17}
        />

        <span
          className={[
            "date-picker__value",
            !selectedDate
              ? "date-picker__value--placeholder"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {selectedDate
            ? displayDate(selectedDate)
            : placeholder}
        </span>

        {selectedDate && clearable && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            className="date-picker__clear"
            onClick={clearDate}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                clearDate(event);
              }
            }}
            aria-label="Clear date"
          >
            <X size={14} />
          </span>
        ) : null}
      </button>

      {error && (
        <div className="date-picker__error">
          {error}
        </div>
      )}

      {open && (
        <div
          className="date-picker__popover"
          role="dialog"
          aria-label="Choose date"
        >
          <div className="date-picker__header">
            <button
              type="button"
              className="date-picker__nav"
              onClick={previousMonth}
              aria-label="Previous month"
            >
              <ChevronLeft size={17} />
            </button>

            <div className="date-picker__month">
              <strong>
                {MONTHS[viewDate.getMonth()]}
              </strong>

              <span>
                {viewDate.getFullYear()}
              </span>
            </div>

            <button
              type="button"
              className="date-picker__nav"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="date-picker__weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-picker__grid">
            {calendarDays.map((date) => {
              const outside =
                date.getMonth() !==
                viewDate.getMonth();

              const selected = isSameDay(
                date,
                selectedDate
              );

              const today =
                todayKey === formatDate(date);

              const dateDisabled =
                isDisabled(date);

              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  disabled={dateDisabled}
                  className={[
                    "date-picker__day",
                    outside
                      ? "date-picker__day--outside"
                      : "",
                    selected
                      ? "date-picker__day--selected"
                      : "",
                    today
                      ? "date-picker__day--today"
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

          <div className="date-picker__footer">
            <button
              type="button"
              className="date-picker__today"
              onClick={goToday}
            >
              Today
            </button>

            <span className="date-picker__format">
              {selectedDate
                ? formatDate(selectedDate)
                : "YYYY-MM-DD"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}