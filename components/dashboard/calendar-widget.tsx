import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerCalendarEvent } from "@/components/dashboard/types";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function buildWeeks(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  const leadingDays = Array.from({ length: firstDay }, (_, i) => ({
    day: prevMonthLastDate - firstDay + 1 + i,
    isCurrentMonth: false,
  }));
  const currentDays = Array.from({ length: lastDate }, (_, i) => ({
    day: i + 1,
    isCurrentMonth: true,
  }));

  const allCells = [...leadingDays, ...currentDays];
  const remaining = allCells.length % 7 === 0 ? 0 : 7 - (allCells.length % 7);
  for (let i = 1; i <= remaining; i++) {
    allCells.push({ day: i, isCurrentMonth: false });
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
  const eventDates = events
    .map((event) => new Date(event.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  const baseDate = eventDates[0] ?? new Date();
  const monthLabel = baseDate.toLocaleString(undefined, { month: "long", year: "numeric" });
  const weeks = buildWeeks(baseDate);
  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();
  const highlightedDays = new Set(
    eventDates.filter((date) => date.getMonth() === month && date.getFullYear() === year).map((date) => date.getDate()),
  );
  const selectedDay = eventDates[0]?.getDate() ?? null;

  return (
    <section className={cn("organizer-panel organizer-panel-hover flex flex-col p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-foreground">{monthLabel}</h3>
        <div className="flex items-center gap-1 text-foreground/45">
          <button className="rounded-full p-1 transition-colors hover:bg-secondary hover:text-foreground" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="rounded-full p-1 transition-colors hover:bg-secondary hover:text-foreground" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-y-1">
        {DAYS.map((day, i) => (
          <div key={i} className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/35">
            {day}
          </div>
        ))}

        {weeks.flat().map((cell, index) => {
          if (!cell.isCurrentMonth) {
            return (
              <div key={`inactive-${index}`} className="py-1.5 text-center text-[12px] font-medium text-foreground/20">
                {cell.day}
              </div>
            );
          }

          const isSelected = selectedDay === cell.day;
          const hasEvent = highlightedDays.has(cell.day) && !isSelected;

          if (isSelected) {
            return (
              <div key={`day-${index}`} className="flex items-center justify-center py-1 text-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/10">
                  <span className="text-[12px] font-bold text-white">{cell.day}</span>
                </div>
              </div>
            );
          }

          if (hasEvent) {
            return (
              <div key={`day-${index}`} className="relative flex justify-center py-1.5 text-center">
                <span className="relative z-10 text-[12px] font-medium text-foreground">{cell.day}</span>
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              </div>
            );
          }

          return (
            <div key={`day-${index}`} className="py-1.5 text-center text-[12px] font-medium text-foreground/80">
              {cell.day}
            </div>
          );
        })}
      </div>

      <div className="my-3 h-px w-full bg-border/70" />

      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-foreground/55">Upcoming Competitions</div>

      {events[0] ? (
        <div className="mt-2">
          <p className="text-[12px] font-medium text-foreground/65">
            {events[0].title} —{" "}
            {new Date(events[0].date).toLocaleString(undefined, {
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
