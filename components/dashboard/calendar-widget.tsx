"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerCalendarEvent } from "@/components/dashboard/types";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

type CalendarCell = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildWeeks(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  const leadingDays: CalendarCell[] = Array.from({ length: firstDay }, (_, index) => {
    const day = prevMonthLastDate - firstDay + 1 + index;

    return {
      day,
      date: new Date(year, month - 1, day),
      isCurrentMonth: false,
    };
  });

  const currentDays: CalendarCell[] = Array.from({ length: lastDate }, (_, index) => {
    const day = index + 1;

    return {
      day,
      date: new Date(year, month, day),
      isCurrentMonth: true,
    };
  });

  const allCells = [...leadingDays, ...currentDays];
  const remaining = allCells.length % 7 === 0 ? 0 : 7 - (allCells.length % 7);

  for (let day = 1; day <= remaining; day += 1) {
    allCells.push({
      day,
      date: new Date(year, month + 1, day),
      isCurrentMonth: false,
    });
  }

  return Array.from({ length: allCells.length / 7 }, (_, index) =>
    allCells.slice(index * 7, index * 7 + 7),
  );
}

export function CalendarWidget({
  className,
  events = [],
}: {
  className?: string;
  events?: OrganizerCalendarEvent[];
}) {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));

  const parsedEvents = useMemo(
    () =>
      events
        .map((event) => ({
          ...event,
          parsedDate: new Date(event.date),
        }))
        .filter((event) => !Number.isNaN(event.parsedDate.getTime()))
        .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime()),
    [events],
  );

  const monthLabel = visibleMonth.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const weeks = buildWeeks(visibleMonth);
  const visibleMonthEventKeys = new Set(
    parsedEvents
      .filter(
        (event) =>
          event.parsedDate.getMonth() === visibleMonth.getMonth() &&
          event.parsedDate.getFullYear() === visibleMonth.getFullYear(),
      )
      .map((event) => getDateKey(event.parsedDate)),
  );
  const nextEvent = parsedEvents[0] ?? null;

  return (
    <section className={cn("organizer-panel organizer-panel-hover flex flex-col p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1 text-foreground/45">
          <button
            type="button"
            className="rounded-full p-1 transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Previous month"
            onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-1 transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Next month"
            onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-y-1" role="grid" aria-label={`${monthLabel} competition calendar`}>
        {DAYS.map((day, index) => (
          <div
            key={`${day}-${index}`}
            role="columnheader"
            className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/35"
          >
            {day}
          </div>
        ))}

        {weeks.flat().map((cell, index) => {
          const isToday = isSameDay(cell.date, today);
          const hasScheduledCompetition = visibleMonthEventKeys.has(getDateKey(cell.date));
          const cellLabel = [
            cell.date.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
            isToday ? "today" : null,
            hasScheduledCompetition ? "scheduled competition" : null,
          ]
            .filter(Boolean)
            .join(", ");

          if (!cell.isCurrentMonth) {
            return (
              <div
                key={`inactive-${index}`}
                role="gridcell"
                aria-label={cellLabel}
                className="py-1.5 text-center text-[12px] font-medium text-foreground/20"
              >
                {cell.day}
              </div>
            );
          }

          return (
            <div key={`day-${index}`} role="gridcell" aria-label={cellLabel}>
              {isToday ? (
                <div className="flex items-center justify-center py-1 text-center">
                  <div
                    aria-current="date"
                    className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                  >
                    <span className="text-[12px] font-bold text-white">{cell.day}</span>
                    {hasScheduledCompetition ? (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-white/90" />
                    ) : null}
                  </div>
                </div>
              ) : hasScheduledCompetition ? (
                <div className="relative flex justify-center py-1.5 text-center">
                  <span className="relative z-10 text-[12px] font-medium text-foreground">{cell.day}</span>
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                </div>
              ) : (
                <div className="py-1.5 text-center text-[12px] font-medium text-foreground/80">
                  {cell.day}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="my-3 h-px w-full bg-border/70" />

      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-foreground/55">Upcoming Competitions</div>

      {nextEvent ? (
        <div className="mt-2">
          <p className="text-[12px] font-medium text-foreground/65">
            {nextEvent.title} -{" "}
            {nextEvent.parsedDate.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-foreground/40">No upcoming competitions scheduled.</p>
      )}
    </section>
  );
}
