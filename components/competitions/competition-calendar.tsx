"use client";

import { CalendarDays } from "lucide-react";
import { LocalDateTime } from "@/components/competitions/local-date-time";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  competitionId: string;
};

function buildCalendarRows(events: CalendarEvent[]) {
  const baseDate = events[0]?.date ?? new Date();
  const monthLabel = baseDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay }, () => "") as string[];

  for (let day = 1; day <= lastDate; day += 1) {
    cells.push(String(day));
  }

  while (cells.length % 7 !== 0) {
    cells.push("");
  }

  const rows = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const selectedDay = events[0] ? String(events[0].date.getDate()) : null;
  const accentDays = new Set(events.map((event) => String(event.date.getDate())));

  return { monthLabel, rows, selectedDay, accentDays };
}

export function CompetitionCalendar({ competitions }: { competitions: DiscoverableCompetition[] }) {
  const events: CalendarEvent[] = competitions
    .map((competition) => {
      const value = competition.startTime ?? competition.registrationStart;
      if (!value) {
        return null;
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return {
        id: competition.id,
        title: competition.name || "Competition",
        date,
        competitionId: competition.id,
      };
    })
    .filter((event): event is CalendarEvent => event !== null)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (events.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No upcoming competition dates match these filters yet.
      </div>
    );
  }

  const { monthLabel, rows, selectedDay, accentDays } = buildCalendarRows(events);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Calendar</p>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
            <CalendarDays className="size-4" />
            {monthLabel}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400">
          {"SMTWTFS".split("").map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-3 space-y-2 text-center text-sm">
          {rows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid grid-cols-7 gap-2">
              {row.map((day, dayIndex) => {
                const isAccent = day && accentDays.has(day);
                const isSelected = day && selectedDay === day;
                return (
                  <span
                    key={`cell-${rowIndex}-${dayIndex}`}
                    className={`flex h-9 items-center justify-center rounded-full ${
                      day
                        ? isSelected
                          ? "bg-[#1a1e2e] text-white"
                          : isAccent
                            ? "bg-[#f49700]/15 text-[#f49700]"
                            : "text-slate-500"
                        : "text-slate-300"
                    }`}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.25)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Next up</p>
        <div className="mt-4 space-y-4">
          {events.slice(0, 6).map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-[#1a1e2e]">{event.title}</p>
                <p className="text-sm text-slate-500">
                  <LocalDateTime
                    value={event.date.toISOString()}
                    options={{
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }}
                  />
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {events.length > 0 ? "Upcoming" : "TBD"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
