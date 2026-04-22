import { AlertCircle, BellRing } from "lucide-react";
import { LocalDateTime } from "@/components/competitions/local-date-time";
import type { CompetitionEventNotice } from "@/lib/competition/events";

type CompetitionEventNoticesProps = {
  notices: CompetitionEventNotice[];
};

function getNoticeToneClasses(tone: CompetitionEventNotice["tone"]) {
  if (tone === "error") {
    return "border-rose-100 bg-rose-50 text-rose-700";
  }

  if (tone === "warning") {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  return "border-sky-100 bg-sky-50 text-sky-700";
}

export function CompetitionEventNotices({ notices }: CompetitionEventNoticesProps) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.25)]">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-[#f49700]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Competition updates
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`rounded-2xl border px-4 py-3 text-sm ${getNoticeToneClasses(notice.tone)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4" />
                {notice.title}
              </p>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                <LocalDateTime
                  value={notice.happenedAt}
                  options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }}
                />
              </span>
            </div>
            <p className="mt-2 leading-6 opacity-90">{notice.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}