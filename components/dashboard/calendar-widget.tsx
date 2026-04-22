import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerCalendarEvent } from "@/components/dashboard/types";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function buildWeeks(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  // Previous month trailing days
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  const leadingDays = Array.from(
    { length: firstDay },
    (_, i) => ({ day: prevMonthLastDate - firstDay + 1 + i, isCurrentMonth: false })
  );

  // Current month days
  const currentDays = Array.from(
    { length: lastDate },
    (_, i) => ({ day: i + 1, isCurrentMonth: true })
  );

  const allCells = [...leadingDays, ...currentDays];

  // Trailing days to fill last week
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
        "bg-white rounded-2xl border border-[#f1f5f9] p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#1a1e2e] text-[14px]">{monthLabel}</h3>
        <div className="flex items-center gap-1 text-[#94a3b8]">
          <button className="p-1 hover:text-[#0d1b2a] transition-colors" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="p-1 hover:text-[#0d1b2a] transition-colors" aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1 gap-y-1">
        {DAYS.map((day, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-[#94a3b8] mb-2">
            {day}
          </div>
        ))}

        {weeks.flat().map((cell, index) => {
          if (!cell.isCurrentMonth) {
            return (
              <div key={`inactive-${index}`} className="text-center py-1.5 text-[12px] font-medium text-[#cbd5e1]">
                {cell.day}
              </div>
            );
          }

          const isSelected = selectedDay === cell.day;
          const hasEvent = highlightedDays.has(cell.day) && !isSelected;

          if (isSelected) {
            return (
              <div key={`day-${index}`} className="text-center py-1 flex justify-center items-center">
                <div className="w-7 h-7 bg-[#f49700] rounded-lg shadow-sm flex items-center justify-center">
                  <span className="text-[12px] font-bold text-white">{cell.day}</span>
                </div>
              </div>
            );
          }

          if (hasEvent) {
            return (
              <div key={`day-${index}`} className="text-center py-1.5 relative flex justify-center">
                <span className="text-[12px] font-medium text-[#1a1e2e] relative z-10">{cell.day}</span>
                <span className="absolute bottom-0.5 w-1 h-1 bg-[#f49700] rounded-full"></span>
              </div>
            );
          }

          return (
            <div key={`day-${index}`} className="text-center py-1.5 text-[12px] font-medium text-[#1a1e2e]">
              {cell.day}
            </div>
          );
        })}
      </div>

      <div className="h-px bg-[#f1f5f9] w-full my-3"></div>

      <div className="text-[12px] font-bold text-[#1a1e2e]">
        Upcoming Competitions
      </div>

      {events[0] ? (
        <div className="mt-2">
          <p className="text-[12px] font-medium text-[#64748b]">
            {events[0].title} —{" "}
            {new Date(events[0].date).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[#94a3b8]">
          No upcoming competitions scheduled.
        </p>
      )}
    </section>
  );
}
