"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Users,
  Calendar,
  Settings,
  Trash2,
  Edit3,
  BarChart2,
  Pause,
  Plus,
  MoreHorizontal,
  Play,
  Eye,
} from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
      return (
        <div className="bg-[#dcfce7] text-[#166534] px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#166534] animate-pulse" />
          Live
        </div>
      );
    case "paused":
      return (
        <div className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          Paused
        </div>
      );
    case "published":
      return (
        <div className="bg-[#fff3e0] text-[#ea580c] px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
          Upcoming
        </div>
      );
    case "draft":
      return (
        <div className="bg-[#f1f5f9] text-[#475569] px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
          Draft
        </div>
      );
    case "ended":
    case "archived":
      return (
        <div className="bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
          Completed
        </div>
      );
    default:
      return (
        <div className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase capitalize">
          {status}
        </div>
      );
  }
}

function CompetitionCard({
  competition,
  deletingCompetitionId,
  onRequestDelete,
}: {
  competition: CompetitionRecord;
  deletingCompetitionId: string | null;
  onRequestDelete: (competition: CompetitionRecord) => void;
}) {
  const isLive = competition.status === "live";
  const isPaused = competition.status === "paused";
  const isUpcoming = competition.status === "published";
  const isDraft = competition.status === "draft";
  const isCompleted = competition.status === "ended" || competition.status === "archived";
  const isDeleting = deletingCompetitionId === competition.id;
  const deleteButtonLabel = isDraft ? "Delete draft competition" : "Delete competition unavailable";

  const cardBase = isDraft
    ? "bg-white rounded-2xl border-2 border-dashed border-[#e2e8f0] p-5 flex flex-col relative h-[260px] hover:bg-slate-50/50 transition-colors"
    : isCompleted
      ? "bg-slate-100/70 rounded-2xl border border-slate-200 p-5 flex flex-col relative h-[260px] group"
      : "bg-white rounded-2xl border border-slate-200 p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col relative h-[260px] group hover:border-[#f49700]/50 transition-colors";

  return (
    <div className={cardBase}>
      {/* Header: Badge + Menu */}
      <div className="flex items-center justify-between mb-auto">
        <StatusBadge status={competition.status} />
        {!isDraft && (
          <ProgressLink
            href={`/organizer/competition/${competition.id}`}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </ProgressLink>
        )}
      </div>

      {/* Body */}
      <div className="mb-6">
        <h3
          className={`font-bold text-xl leading-snug mb-3 line-clamp-2 ${
            isDraft ? "text-slate-400" : isCompleted ? "text-slate-800" : "text-[#10182b]"
          }`}
        >
          {competition.name || "Untitled competition"}
        </h3>

        {isDraft ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-400 text-[13px] font-medium">
            <div className="flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" /> Drafting Content
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-500 text-[13px] font-medium">
            <div className="flex items-center gap-1.5">
              {competition.format === "team" ? (
                <>
                  <Users className="w-4 h-4" /> Team
                  {competition.participantsPerTeam
                    ? ` (${competition.participantsPerTeam})`
                    : ""}
                </>
              ) : (
                <>
                  <User className="w-4 h-4" /> Individual
                </>
              )}
            </div>
            {competition.startTime && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {formatDate(competition.startTime)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-3 mt-auto">
        {isLive && (
          <>
            <ProgressLink
              href={`/organizer/competition/${competition.id}`}
              className="flex-1 bg-[#10182b] hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-[14px] transition-colors text-center"
            >
              Live View
            </ProgressLink>
            <button className="w-12 h-12 shrink-0 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition-colors">
              <Pause className="w-5 h-5" />
            </button>
          </>
        )}

        {isPaused && (
          <>
            <ProgressLink
              href={`/organizer/competition/${competition.id}`}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#10182b] py-3 rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> Resume
            </ProgressLink>
            <ProgressLink
              href={`/organizer/competition/${competition.id}`}
              className="w-12 h-12 shrink-0 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 transition-colors"
            >
              <Eye className="w-5 h-5" />
            </ProgressLink>
          </>
        )}

        {isUpcoming && (
          <>
            <ProgressLink
              href={`/organizer/competition/${competition.id}`}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#10182b] py-3 rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" /> Manage
            </ProgressLink>
            <button
              type="button"
              disabled
              aria-label={deleteButtonLabel}
              title="Only draft competitions can be deleted"
              className="w-12 h-12 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        )}

        {isDraft && (
          <>
            <ProgressLink
              href={`/organizer/competition/${competition.id}`}
              className="flex-1 bg-[#f49700] hover:bg-[#e08900] text-[#10182b] py-3 rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Edit3 className="w-4 h-4" /> Edit Draft
            </ProgressLink>
            <button
              type="button"
              aria-label={deleteButtonLabel}
              title="Delete draft competition"
              disabled={isDeleting}
              onClick={() => {
                onRequestDelete(competition);
              }}
              className="w-12 h-12 shrink-0 bg-slate-50 hover:bg-red-50 hover:text-red-600 rounded-xl flex items-center justify-center text-slate-400 transition-colors border border-slate-100 disabled:cursor-not-allowed disabled:hover:bg-slate-50 disabled:hover:text-slate-400"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        )}

        {isCompleted && (
          <ProgressLink
            href={`/organizer/competition/${competition.id}`}
            className="flex-1 bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] shadow-sm hover:shadow-md py-3 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
          >
            <BarChart2 className="w-4 h-4" /> View Report
          </ProgressLink>
        )}
      </div>
    </div>
  );
}

interface CompetitionCardGridProps {
  competitions: CompetitionRecord[];
}

export function CompetitionCardGrid({ competitions }: CompetitionCardGridProps) {
  const [activeTab, setActiveTab] = useState<Tab>("All Events");
  const [items, setItems] = useState(competitions);
  const [competitionToDelete, setCompetitionToDelete] = useState<CompetitionRecord | null>(null);
  const [deletingCompetitionId, setDeletingCompetitionId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  useEffect(() => {
    setItems(competitions);
  }, [competitions]);

  const filtered =
    activeTab === "All Events"
      ? items
      : items.filter((c) => mapStatusToTab(c.status) === activeTab);

  async function handleDeleteCompetition() {
    const competition = competitionToDelete;
    if (!competition) {
      return;
    }

    if (competition.status !== "draft") {
      return;
    }

    setDeletingCompetitionId(competition.id);
    setDeleteError("");
    try {
      const response = await fetch(`/api/organizer/competitions/${competition.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "x-idempotency-key": crypto.randomUUID(),
        },
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setDeleteError(payload?.message ?? "Draft could not be deleted.");
        return;
      }

      setItems((current) => current.filter((item) => item.id !== competition.id));
      setCompetitionToDelete(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Draft could not be deleted.");
    } finally {
      setDeletingCompetitionId((current) => (current === competition.id ? null : current));
    }
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-full text-[14px] font-bold transition-all ${
              activeTab === tab
                ? "bg-[#10182b] text-white shadow-md"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-[#10182b]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((competition) => (
          <CompetitionCard
            key={competition.id}
            competition={competition}
            deletingCompetitionId={deletingCompetitionId}
            onRequestDelete={(nextCompetition) => {
              setDeleteError("");
              setCompetitionToDelete(nextCompetition);
            }}
          />
        ))}

        {/* Quick Start Card */}
        <ProgressLink
          href="/organizer/competition/create"
          className="rounded-2xl border-2 border-dashed border-[#e2e8f0] p-5 flex flex-col h-[260px] hover:border-[#f49700]/50 hover:bg-[#f49700]/5 transition-all items-center justify-center group no-underline"
        >
          <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-white group-hover:shadow-sm flex items-center justify-center text-slate-400 group-hover:text-[#f49700] transition-all mb-4">
            <Plus className="w-8 h-8" />
          </div>
          <span className="font-bold text-slate-400 group-hover:text-[#f49700] text-[15px] transition-colors w-[60%] text-center">
            Quick Start New Draft Competition
          </span>
        </ProgressLink>
      </div>

      {/* Empty state for filtered view */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <BarChart2 className="w-7 h-7" />
          </div>
          <p className="font-bold text-slate-500 text-[15px] mb-1">
            No competitions found
          </p>
          <p className="text-slate-400 text-[13px]">
            There are no competitions matching the &ldquo;{activeTab}&rdquo; filter.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={competitionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCompetitionToDelete(null);
            setDeleteError("");
          }
        }}
        title="Delete draft?"
        description={`This will remove "${competitionToDelete?.name || "Untitled competition"}" from your organizer workspace. Published competitions are not affected.`}
        confirmLabel="Delete"
        confirmDisabled={deletingCompetitionId !== null}
        pending={deletingCompetitionId !== null}
        pendingLabel="Deleting..."
        onConfirm={handleDeleteCompetition}
      >
        {deleteError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {deleteError}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
