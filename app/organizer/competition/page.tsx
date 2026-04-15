import { CalendarClock, CirclePlus, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";

function statusBadgeVariant(status: CompetitionRecord["status"]) {
  if (status === "draft") {
    return "secondary" as const;
  }

  if (status === "archived") {
    return "outline" as const;
  }

  return "default" as const;
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
    <section className="shell py-12 space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="surface-card overflow-hidden border-border/60">
          <CardHeader>
            <div className="eyebrow">Organizer Competitions</div>
            <CardTitle className="mt-6 text-4xl">Competition workspace</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              Create drafts, shape schedule and format, then publish with frozen snapshots and guarded lifecycle controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Drafts</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{counts.draft}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{counts.live + counts.published + counts.paused}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Archived</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{counts.archived}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5">
              <CalendarClock className="size-5 text-primary" />
              <p className="text-sm leading-6 text-foreground">
                Drafts save incrementally. Publish freezes scoring and selected problem snapshots.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/70 shadow-sm">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">New draft</p>
              <p className="mt-3 text-lg font-semibold text-foreground">Start a competition wizard</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Create a new draft, define schedule and format, then continue into problems and scoring.
              </p>
            </div>

            <ProgressLink
              href="/organizer/competition/create"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              <CirclePlus className="size-4" />
              Create competition
            </ProgressLink>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Unable to load competitions.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Your competitions</h2>
          <Badge variant="outline">{competitions.length} total</Badge>
        </div>

        {competitions.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-muted/20">
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <Trophy className="size-5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No competitions yet</p>
                <p className="text-sm text-muted-foreground">
                  Create the first draft and start building schedule, problem selection, and scoring.
                </p>
              </div>
              <ProgressLink
                href="/organizer/competition/create"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                <CirclePlus className="size-4" />
                Create draft
              </ProgressLink>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {competitions.map((competition) => (
              <Card key={competition.id} className="border-border/60 bg-background/90 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusBadgeVariant(competition.status)}>{competition.status}</Badge>
                    <Badge variant="outline">{competition.type}</Badge>
                    <Badge variant="outline">{competition.format}</Badge>
                  </div>
                  <CardTitle className="line-clamp-1 text-xl">{competition.name || "Untitled competition"}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10">
                    {competition.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Revision</p>
                      <p className="mt-2 font-medium text-foreground">{competition.draftRevision}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Updated</p>
                      <p className="mt-2 font-medium text-foreground">{new Date(competition.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Answer key: {competition.answerKeyVisibility}</p>
                    <ProgressLink
                      href={`/organizer/competition/${competition.id}`}
                      className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Open wizard
                    </ProgressLink>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
