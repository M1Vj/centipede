import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerCalendarEvent } from "@/components/dashboard/types";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildWeeks(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const cells = Array.from({ length: firstDay }, () => null) as Array<number | null>;
  for (let day = 1; day <= lastDate; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}

export function CalendarWidget({
  className,
  events = [],
}: {
  className?: string;
  events?: OrganizerCalendarEvent[];
}) {
  const eventDates = events
    .map((event) => new Date(event.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  const baseDate = eventDates[0] ?? new Date();
  const monthLabel = baseDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const weeks = buildWeeks(baseDate);
  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();
  const highlightedDays = new Set(
    eventDates
      .filter((date) => date.getMonth() === month && date.getFullYear() === year)
      .map((date) => date.getDate()),
  );
  const selectedDay = eventDates[0]?.getDate() ?? null;

  return (
    <section
      className={cn(
        "rounded-[28px] bg-[#10182b] p-6 text-white shadow-[0_28px_60px_-34px_rgba(15,23,42,0.88)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-2 text-white/70">
          <ChevronLeft className="size-4" />
          <ChevronRight className="size-4" />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-7 gap-y-4 text-center">
        {DAYS.map((day) => (
          <span key={day} className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {day}
          </span>
        ))}
        {weeks.flat().map((day, index) => {
          if (!day) {
            return <span key={`empty-${index}`} className="h-8" aria-hidden="true" />;
          }

          const isSelected = selectedDay === day;
          const hasEvent = highlightedDays.has(day) && !isSelected;

          return (
            <div key={`${day}-${index}`} className="relative flex justify-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold",
                  isSelected ? "bg-[#f97316] text-white" : "text-white",
                )}
              >
                {day}
              </span>
              {hasEvent ? (
                <span className="absolute bottom-0 h-1 w-1 rounded-full bg-[#f97316]" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-white/10 pt-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
          Next Event
        </p>
        <div className="mt-4 rounded-2xl bg-white/6 p-4">
          {events[0] ? (
            <>
              <p className="text-sm font-bold text-white">{events[0].title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(events[0].date).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-white">No scheduled competition</p>
              <p className="mt-1 text-xs text-slate-400">Create or publish a competition to surface it here.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
