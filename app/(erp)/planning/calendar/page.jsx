"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Clock3,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";

import "./PlanningCalendar.css";

const EVENT_TYPES = {
  production: {
    label: "Production",
    className: "production",
  },
  material: {
    label: "Material",
    className: "material",
  },
  shortage: {
    label: "Shortage",
    className: "shortage",
  },
  mrp: {
    label: "MRP Run",
    className: "mrp",
  },
};

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function getMonthLabel(date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMonthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Convert Sunday-first JS index into Monday-first index.
  const leadingDays =
    (firstDay.getDay() + 6) % 7;

  const totalDays = lastDay.getDate();

  const cells = [];

  for (let i = 0; i < leadingDays; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(
      new Date(year, month, day)
    );
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function formatDateKey(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/*
 * Minute ticker for the live "today" value. This subscribes to the
 * system clock as an external store: the highlighted day updates when
 * the day changes, without setting state synchronously inside an
 * effect. Only runs on the client.
 */
function subscribeToClock(onStoreChange) {
  const timer = window.setInterval(
    onStoreChange,
    60 * 1000
  );

  return () => window.clearInterval(timer);
}

const PLACEHOLDER_DATE = new Date(2000, 0, 1);

export default function PlanningCalendarPage() {
  /*
   * null means "follow the live current month". The month label and
   * grid fall back to a fixed placeholder until the client has the
   * live today value, which keeps server and hydration renders
   * identical without a setState call inside an effect.
   */
  const [currentDate, setCurrentDate] = useState(null);

  /*
   * Live "today" key subscribed from the clock ticker (external
   * system) instead of an interval that sets state inside an effect.
   * The server snapshot is empty for hydration safety.
   */
  const todayKey = useSyncExternalStore(
    subscribeToClock,
    () => formatDateKey(new Date()),
    () => ""
  );

  const [search, setSearch] = useState("");
  const [eventType, setEventType] =
    useState("all");

  /*
   * Backend integration point.
   *
   * Future API response:
   *
   * Production Plans
   * Material Requirements
   * Shortages
   * MRP Runs
   * Capacity Events
   *        ↓
   * Unified Planning Calendar
   *
   * No fake records are used.
   */
  const events = useMemo(() => [], []);

  /*
   * The displayed month is derived: an explicitly navigated month
   * wins, otherwise the live current month is used (placeholder on
   * the server / during hydration).
   */
  const viewDate = useMemo(() => {
    if (currentDate) return currentDate;

    if (!todayKey) return PLACEHOLDER_DATE;

    return new Date();
  }, [currentDate, todayKey]);

  const days = useMemo(
    () => getMonthDays(viewDate),
    [viewDate]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const searchableText = [
        event.title,
        event.description,
        event.reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(
          search.toLowerCase()
        );

      const matchesType =
        eventType === "all" ||
        event.type === eventType;

      return matchesSearch && matchesType;
    });
  }, [events, search, eventType]);

  const eventsByDate = useMemo(() => {
    return filteredEvents.reduce(
      (result, event) => {
        if (!event.date) return result;

        if (!result[event.date]) {
          result[event.date] = [];
        }

        result[event.date].push(event);

        return result;
      },
      {}
    );
  }, [filteredEvents]);

  const goToPreviousMonth = () => {
    setCurrentDate(
      (previous) => {
        const base = previous ?? new Date();

        return new Date(
          base.getFullYear(),
          base.getMonth() - 1,
          1
        );
      }
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      (previous) => {
        const base = previous ?? new Date();

        return new Date(
          base.getFullYear(),
          base.getMonth() + 1,
          1
        );
      }
    );
  };

  const goToToday = () => {
    /*
     * Follow the live current month again; the highlighted day is
     * already kept up to date by the clock subscription.
     */
    setCurrentDate(null);
  };

  const handleRefresh = () => {
    /*
     * API refresh will be connected later.
     */
  };

  return (
    <main className="planning-calendar">
      <PageHeader
        eyebrow="PLANNING / CALENDAR"
        title="Planning Calendar"
        description="Coordinate production schedules, material requirements, MRP activity and planning exceptions on a unified timeline."
        action={
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
      />

      <div className="planning-calendar__content">
        <section className="planning-calendar__toolbar">
          <div className="planning-calendar__search">
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
            />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search planning events..."
              aria-label="Search planning events"
            />
          </div>

          <div className="planning-calendar__filters">
            <div className="planning-calendar__filter">
              <Filter
                size={15}
                strokeWidth={1.8}
                aria-hidden="true"
              />

              <label htmlFor="calendar-event-type">
                Event Type
              </label>

              <select
                id="calendar-event-type"
                value={eventType}
                onChange={(event) =>
                  setEventType(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Events
                </option>

                <option value="production">
                  Production
                </option>

                <option value="material">
                  Material
                </option>

                <option value="shortage">
                  Shortage
                </option>

                <option value="mrp">
                  MRP Run
                </option>
              </select>
            </div>
          </div>
        </section>

        <section className="planning-calendar__legend">
          {Object.entries(EVENT_TYPES).map(
            ([key, config]) => (
              <span
                key={key}
                className={`planning-calendar__legend-item planning-calendar__legend-item--${config.className}`}
              >
                <span className="planning-calendar__legend-dot" />
                {config.label}
              </span>
            )
          )}
        </section>

        <section className="planning-calendar__card">
          <header className="planning-calendar__calendar-header">
            <div className="planning-calendar__month">
              <button
                type="button"
                className="planning-calendar__nav-button"
                onClick={goToPreviousMonth}
                aria-label="Previous month"
              >
                <ChevronLeft
                  size={18}
                  strokeWidth={1.8}
                />
              </button>

              <h2>
                {getMonthLabel(viewDate)}
              </h2>

              <button
                type="button"
                className="planning-calendar__nav-button"
                onClick={goToNextMonth}
                aria-label="Next month"
              >
                <ChevronRight
                  size={18}
                  strokeWidth={1.8}
                />
              </button>
            </div>

            <Button
              variant="secondary"
              size="small"
              icon={CalendarDays}
              onClick={goToToday}
            >
              Today
            </Button>
          </header>

          <div className="planning-calendar__weekdays">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday}>
                {weekday}
              </div>
            ))}
          </div>

          {events.length === 0 ? (
            <div className="planning-calendar__empty-wrapper">
              <EmptyState
                icon={CalendarDays}
                title="No planning events"
                description="Planning events will appear here when production plans, material requirements, shortages and MRP schedules are available."
              />
            </div>
          ) : (
            <div className="planning-calendar__grid">
              {days.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="planning-calendar__day planning-calendar__day--empty"
                    />
                  );
                }

                const dateKey =
                  formatDateKey(day);

                const dayEvents =
                  eventsByDate[dateKey] || [];

                return (
                  <div
                    key={dateKey}
                    className={`planning-calendar__day ${
                      formatDateKey(day) === todayKey
                        ? "planning-calendar__day--today"
                        : ""
                    }`}
                  >
                    <div className="planning-calendar__day-number">
                      {day.getDate()}
                    </div>

                    <div className="planning-calendar__events">
                      {dayEvents.map(
                        (event) => {
                          const config =
                            EVENT_TYPES[
                              event.type
                            ] ||
                            EVENT_TYPES.production;

                          return (
                            <button
                              type="button"
                              key={event.id}
                              className={`planning-calendar__event planning-calendar__event--${config.className}`}
                            >
                              <span>
                                {event.title}
                              </span>

                              {event.reference && (
                                <small>
                                  {
                                    event.reference
                                  }
                                </small>
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="planning-calendar__upcoming">
          <div className="planning-calendar__section-heading">
            <div>
              <h2>Upcoming Planning Activity</h2>
              <p>
                Scheduled planning events within
                the current planning horizon.
              </p>
            </div>

            <span>
              {filteredEvents.length} event
              {filteredEvents.length === 1
                ? ""
                : "s"}
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <EmptyState
              size="small"
              icon={Clock3}
              title="No upcoming activity"
              description="Upcoming planning activity will appear here once scheduling data is available."
            />
          ) : (
            <div className="planning-calendar__upcoming-list">
              {filteredEvents.map((event) => {
                const config =
                  EVENT_TYPES[event.type] ||
                  EVENT_TYPES.production;

                return (
                  <div
                    key={event.id}
                    className="planning-calendar__upcoming-item"
                  >
                    <span
                      className={`planning-calendar__upcoming-marker planning-calendar__upcoming-marker--${config.className}`}
                    />

                    <div>
                      <strong>
                        {event.title}
                      </strong>

                      <span>
                        {event.date || "—"}
                        {event.reference
                          ? ` · ${event.reference}`
                          : ""}
                      </span>
                    </div>

                    <span
                      className={`planning-calendar__upcoming-type planning-calendar__upcoming-type--${config.className}`}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}