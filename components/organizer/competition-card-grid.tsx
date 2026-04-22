"use client";

import { useState } from "react";
import {
  BarChart2,
  Calendar,
  Edit3,
  Pause,
  Play,
  Plus,
  Settings,
  Trash2,
  User,
  Users,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import type { CompetitionRecord } from "@/lib/competition/types";

const TABS = ["All Events", "Active", "Upcoming", "Drafts", "Completed"] as const;
type Tab = (typeof TABS)[number];

function mapStatusToTab(status: CompetitionRecord["status"]): Tab {
  switch (status) {
    case "live":
    case "paused":
      return "Active";
    case "published":
      return "Upcoming";
    case "draft":
      return "Drafts";
    case "ended":
    case "archived":
      return "Completed";
    default:
      return "All Events";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: CompetitionRecord["status"] }) {
  switch (status) {
    case "live":
      return <div className="flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#166534]"><div className="h-1.5 w-1.5 rounded-full bg-[#166534]" />Live</div>;
    case "paused":
      return <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700"><div className="h-1.5 w-1.5 rounded-full bg-amber-600" />Paused</div>;
    case "published":
      return <div className="rounded-full bg-[#fff3e0] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#ea580c]">Upcoming</div>;
    case "draft":
      return <div className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-foreground/55">Draft</div>;
    case "ended":
    case "archived":
      return <div className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-foreground/50">Completed</div>;
    default:
      return <div className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-foreground/50">{status}</div>;
  }
}

function CompetitionCard({ competition }: { competition: CompetitionRecord }) {
  const isLive = competition.status === "live";
  const isPaused = competition.status === "paused";
  const isUpcoming = competition.status === "published";
  const isDraft = competition.status === "draft";
  const isCompleted = competition.status === "ended" || competition.status === "archived";

  const cardBase = isDraft
    ? "organizer-panel organizer-panel-soft p-5 flex flex-col relative h-[260px] transition-all duration-300 hover:-translate-y-0.5"
    : isCompleted
      ? "organizer-panel p-5 flex flex-col relative h-[260px] group opacity-95"
      : "organizer-panel organizer-panel-hover p-5 flex flex-col relative h-[260px] group";

  return (
    <div className={cardBase}>
      <div className="mb-auto flex items-center justify-between">
        <StatusBadge status={competition.status} />
        {!isDraft ? (
          <ProgressLink href={`/organizer/competition/${competition.id}`} className="text-foreground/40 transition-colors hover:text-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </ProgressLink>
        ) : null}
      </div>

      <div className="mb-6">
        <h3 className={`mb-3 line-clamp-2 text-xl font-bold leading-snug ${isDraft ? "text-foreground/45" : isCompleted ? "text-foreground/80" : "text-foreground"}`}>
          {competition.name || "Untitled competition"}
        </h3>

        {isDraft ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-foreground/45">
            <div className="flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" /> Drafting Content
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-foreground/60">
            <div className="flex items-center gap-1.5">
              {competition.format === "team" ? (
                <>
                  <Users className="w-4 h-4" /> Team
                  {competition.participantsPerTeam ? ` (${competition.participantsPerTeam})` : ""}
                </>
              ) : (
                <>
                  <User className="w-4 h-4" /> Individual
                </>
              )}
            </div>
            {competition.startTime ? (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {formatDate(competition.startTime)}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-3">
        {isLive ? (
          <>
            <ProgressLink href={`/organizer/competition/${competition.id}`} className="flex-1 rounded-xl bg-primary py-3 text-center text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/90">
              Live View
            </ProgressLink>
            <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75 transition-colors hover:bg-secondary/80 hover:text-foreground">
              <Pause className="w-5 h-5" />
            </button>
          </>
        ) : null}

        {isPaused ? (
          <>
            <ProgressLink href={`/organizer/competition/${competition.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-[14px] font-bold text-foreground transition-colors hover:bg-secondary/80">
              <Play className="w-4 h-4" /> Resume
            </ProgressLink>
            <ProgressLink href={`/organizer/competition/${competition.id}`} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/55 transition-colors hover:bg-secondary/80 hover:text-foreground">
              <Eye className="w-5 h-5" />
            </ProgressLink>
          </>
        ) : null}

        {isUpcoming ? (
          <>
            <ProgressLink href={`/organizer/competition/${competition.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-[14px] font-bold text-foreground transition-colors hover:bg-secondary/80">
              <Settings className="w-4 h-4" /> Manage
            </ProgressLink>
            <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/55 transition-colors hover:bg-red-50 hover:text-red-600">
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        ) : null}

        {isDraft ? (
          <>
            <ProgressLink href={`/organizer/competition/${competition.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[14px] font-bold text-primary-foreground shadow-sm shadow-primary/10 transition-colors hover:bg-primary/90">
              <Edit3 className="w-4 h-4" /> Edit Draft
            </ProgressLink>
            <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-foreground/40 transition-colors hover:bg-red-50 hover:text-red-600">
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        ) : null}

        {isCompleted ? (
          <ProgressLink href={`/organizer/competition/${competition.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background py-3 text-[14px] font-bold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <BarChart2 className="w-4 h-4" /> View Report
          </ProgressLink>
        ) : null}
      </div>
    </div>
  );
}

export function CompetitionCardGrid({ competitions }: { competitions: CompetitionRecord[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("All Events");

  const filtered =
    activeTab === "All Events" ? competitions : competitions.filter((c) => mapStatusToTab(c.status) === activeTab);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`organizer-tab ${activeTab === tab ? "organizer-tab-active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((competition) => (
          <CompetitionCard key={competition.id} competition={competition} />
        ))}

        <ProgressLink
          href="/organizer/competition/create"
          className="organizer-panel organizer-panel-soft flex h-[260px] flex-col items-center justify-center p-5 text-center no-underline transition-all duration-300 hover:-translate-y-0.5"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-foreground/35 transition-all hover:bg-background hover:text-primary">
            <Plus className="w-8 h-8" />
          </div>
          <span className="w-[60%] text-[15px] font-bold text-foreground/45 transition-colors hover:text-primary">
            Quick Start New Draft Competition
          </span>
        </ProgressLink>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-foreground/35">
            <BarChart2 className="w-7 h-7" />
          </div>
          <p className="mb-1 text-[15px] font-bold text-foreground/70">No competitions found</p>
          <p className="text-[13px] text-foreground/45">
            There are no competitions matching the &ldquo;{activeTab}&rdquo; filter.
          </p>
        </div>
      ) : null}
    </>
  );
}
