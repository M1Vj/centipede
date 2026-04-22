import { CalendarClock, CirclePlus, Trophy } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { CompetitionCardGrid } from "@/components/organizer/competition-card-grid";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";

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
        .filter((row): row is NonNullable<ReturnType<typeof normalizeCompetitionRecord>> => row !== null)
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
    <section className="organizer-shell flex w-full justify-center px-4">
      <div className="shell flex w-full max-w-[1024px] flex-col pb-12 pt-8 md:pt-10 font-['Poppins'] space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="organizer-kicker mb-3">Organizer / competitions</span>
            <h1 className="mb-2 text-3xl font-black leading-tight tracking-tight text-foreground md:text-[34px]">
              Competition Dashboard
            </h1>
            <p className="text-[15px] font-medium text-foreground/60">
              Overview of your active and upcoming mathematical events.
            </p>
          </div>
          <ProgressLink href="/organizer/competition/create" className="organizer-action self-start no-underline md:self-auto">
            <CirclePlus className="size-5" />
            Create New Competition
          </ProgressLink>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            Unable to load competitions. Please try again later.
          </div>
        ) : null}

        {!error && competitions.length === 0 ? (
          <div className="organizer-panel organizer-panel-soft flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-foreground/35">
              <Trophy className="size-9" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">No competitions yet</h2>
            <p className="mb-6 max-w-md text-[14px] text-foreground/55">
              Create your first competition to begin schedule setup, problem selection, and scoring configuration.
            </p>
            <ProgressLink href="/organizer/competition/create" className="organizer-action no-underline">
              <CirclePlus className="size-5" />
              Create Draft
            </ProgressLink>
          </div>
        ) : null}

        {!error && competitions.length > 0 ? (
          <div className="space-y-4">
            <div className="organizer-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">Competition overview</p>
                <p className="mt-1 text-sm text-foreground/60">
                  {counts.draft} drafts, {counts.live + counts.published + counts.paused} active, {counts.archived} archived.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-sm text-foreground/65">
                <CalendarClock className="size-4 text-primary" />
                Drafts save incrementally
              </div>
            </div>
            <CompetitionCardGrid competitions={competitions} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
