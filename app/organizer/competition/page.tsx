import { CalendarClock, CirclePlus, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressLink } from "@/components/ui/progress-link";
import {
  OrganizerMetricTile,
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerPrimaryActionClass,
} from "@/components/organizer/workspace-patterns";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import { cn } from "@/lib/utils";

function statusBadgeVariant(status: CompetitionRecord["status"]) {
  if (status === "draft") {
    return "secondary" as const;
  }

  if (status === "archived") {
    return "outline" as const;
  }

  return "default" as const;
}

function statusBadgeClass(status: CompetitionRecord["status"]) {
  switch (status) {
    case "draft":
      return "bg-muted text-muted-foreground";
    case "live":
      return "bg-green-500/10 text-green-600";
    case "paused":
      return "bg-amber-500/10 text-amber-600";
    case "ended":
      return "bg-violet-500/10 text-violet-600";
    case "archived":
      return "bg-muted text-muted-foreground opacity-80";
    case "published":
    default:
      return "bg-primary/10 text-primary";
  }
}

export default async function OrganizerCompetitionPage() {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const supabase = await createClient();

  const primaryResult = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("organizer_id", profile?.id)
    .order("created_at", { ascending: false });

  const fallbackResult =
    primaryResult.error && isLegacyCompetitionSelectError(primaryResult.error)
      ? await supabase
          .from("competitions")
          .select(LEGACY_COMPETITION_SELECT_COLUMNS)
          .eq("organizer_id", profile?.id)
          .order("created_at", { ascending: false })
      : null;

  const data = fallbackResult ? fallbackResult.data : primaryResult.data;
  const error = fallbackResult ? fallbackResult.error : primaryResult.error;

  const competitions = !error
    ? (data ?? [])
        .map((row) => normalizeCompetitionRecord(row))
        .filter((row): row is CompetitionRecord => row !== null)
    : [];

  const counts = competitions.reduce(
    (summary, competition) => {
      summary[competition.status] += 1;
      return summary;
    },
    {
      draft: 0,
      published: 0,
      live: 0,
      paused: 0,
      ended: 0,
      archived: 0,
    },
  );

  return (
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        eyebrow="Competition Workspace"
        title="Competitions"
        description="Create drafts, configure schedule and scoring, then publish immutable competition snapshots with trusted lifecycle controls."
        actions={
          <ProgressLink
            href="/organizer/competition/create"
            className={cn(organizerPrimaryActionClass, "rounded-2xl bg-[#f59f0a] px-5 text-white hover:bg-[#e79009]")}
          >
            <CirclePlus className="size-4" />
            Create Competition
          </ProgressLink>
        }
      />

      <OrganizerWorkspacePanel className="space-y-4 border-[#f2d8ac] bg-white/90">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OrganizerMetricTile label="Total" value={competitions.length} />
          <OrganizerMetricTile label="Draft" value={counts.draft} />
          <OrganizerMetricTile label="Active" value={counts.live + counts.published + counts.paused} />
          <OrganizerMetricTile label="Archived" value={counts.archived} />
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <CalendarClock className="size-4 text-primary" />
          Drafts save incrementally. Publish freezes selected problems and scoring snapshots.
        </div>
      </OrganizerWorkspacePanel>

      {error ? (
        <OrganizerWorkspacePanel className="border-destructive/30 bg-destructive/10 text-sm text-destructive">
          Unable to load competitions.
        </OrganizerWorkspacePanel>
      ) : null}

      <OrganizerWorkspacePanel className="space-y-4 border-[#f2d8ac] bg-white/95 p-0">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f59f0a]">Organizer workspace</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Competition drafts and published runs</h2>
          </div>
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs font-semibold">
            {competitions.length} total
          </Badge>
        </div>

        {competitions.length === 0 ? (
            <div className="space-y-4 px-6 py-8">
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm">
                <Trophy className="mt-0.5 size-4 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">No competitions yet</p>
                <p className="text-muted-foreground">
                  Create your first draft to begin schedule setup, problem selection, and scoring configuration.
                </p>
              </div>
            </div>
            <ProgressLink href="/organizer/competition/create" className={organizerPrimaryActionClass}>
              <CirclePlus className="size-4" />
              Create draft
            </ProgressLink>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto px-2 pb-2 md:block">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200/80 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-4 py-3 font-semibold">Competition</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Type / Format</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.map((competition) => (
                    <tr
                      key={competition.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-semibold text-slate-900">
                          {competition.name || "Untitled competition"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {competition.description || "No description provided."}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Revision {competition.draftRevision} | Answer key: {competition.answerKeyVisibility}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            statusBadgeClass(competition.status),
                          )}
                        >
                          {competition.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <p className="capitalize">{competition.type}</p>
                        <p className="capitalize text-slate-500">{competition.format}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        {new Date(competition.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <ProgressLink
                          href={`/organizer/competition/${competition.id}`}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          Open wizard
                        </ProgressLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 px-5 pb-5 md:hidden">
              {competitions.map((competition) => (
                <div
                  key={competition.id}
                  className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                        statusBadgeClass(competition.status),
                      )}
                    >
                      {competition.status}
                    </span>
                    <Badge variant={statusBadgeVariant(competition.status)} className="capitalize">
                      {competition.type}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {competition.format}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {competition.name || "Untitled competition"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {competition.description || "No description provided."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>Revision {competition.draftRevision}</span>
                    <span>{new Date(competition.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <ProgressLink
                    href={`/organizer/competition/${competition.id}`}
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Open wizard
                  </ProgressLink>
                </div>
              ))}
            </div>
          </>
        )}
      </OrganizerWorkspacePanel>
    </OrganizerWorkspaceShell>
  );
}
