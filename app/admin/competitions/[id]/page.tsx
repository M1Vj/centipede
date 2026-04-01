import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteCompetition, toggleCompetitionPause } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Trophy, Pause, Play, Calendar, Users, Timer } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { DetailSectionSkeleton } from "@/components/ui/feedback-skeletons";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function CompetitionContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch competition details including organizer
  const { data: competition, error } = await supabase
    .from("competitions")
    .select(`
      *,
      profiles!competitions_organizer_id_fkey (full_name, email, organization)
    `)
    .eq("id", id)
    .single();

  if (error || !competition) {
    notFound();
  }

  async function handleTogglePause() {
    "use server";
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    try {
      await toggleCompetitionPause(id, !competition.is_paused, user?.id);
    } catch (err) {
      console.error("Failed to toggle competition pause:", err);
    }
    redirect(`/admin/competitions/${id}`);
  }

  async function handleDelete() {
    "use server";
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    try {
      await deleteCompetition(id, user?.id);
    } catch (err) {
      console.error("Failed to delete competition:", err);
    }
    redirect("/admin/competitions");
  }

  const statusBadge = competition.is_paused ? (
    <Badge variant="destructive" className="gap-1 animate-pulse">
      <Pause className="size-3" />
      Paused
    </Badge>
  ) : (
    <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600 text-white border-0">
      <Play className="size-3" />
      Active
    </Badge>
  );

  return (
    <div className="grid gap-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <ProgressLink
          href="/admin/competitions"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Competitions
        </ProgressLink>

        <div className="flex gap-3">
          <form action={handleTogglePause}>
            <Button variant="outline" size="sm" className="gap-2">
              {competition.is_paused ? (
                <>
                  <Play className="size-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="size-4" />
                  Force Pause
                </>
              )}
            </Button>
          </form>
          <form action={handleDelete}>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="size-4" />
              Delete Competition
            </Button>
          </form>
        </div>
      </div>

      <Card className="surface-card border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-[0_8px_30px_-12px_rgba(245,158,11,0.5)]">
                <Trophy className="size-6" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold tracking-tight">
                  {competition.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Managed by {competition.profiles?.full_name} ({competition.profiles?.organization || "Independent"})
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {statusBadge}
              {competition.published && (
                <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase">
                  Published
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary/80 mb-3">Description</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {competition.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Calendar className="size-3.5" />
                Format
              </div>
              <p className="text-sm font-semibold capitalize">{competition.format}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Timer className="size-3.5" />
                Duration
              </div>
              <p className="text-sm font-semibold">{competition.duration_minutes} Minutes</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="size-3.5" />
                Max Participants
              </div>
              <p className="text-sm font-semibold">{competition.max_participants || "Unlimited"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Play className="size-3.5" />
                Type
              </div>
              <p className="text-sm font-semibold capitalize">{competition.type}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">Competition Rules & Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted-foreground">Scoring Mode</span>
                <span className="font-medium capitalize">{competition.scoring_mode}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted-foreground">Penalty Mode</span>
                <span className="font-medium capitalize">{competition.penalty_mode}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted-foreground">Shuffle Questions</span>
                <span className="font-medium">{competition.shuffle_questions ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-muted-foreground">Anti-Cheat Tabs</span>
                <span className="font-medium">{competition.log_tab_switch ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompetitionFallback() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          <div className="h-9 w-32 bg-muted animate-pulse rounded" />
        </div>
      </div>
      <DetailSectionSkeleton lines={5} />
    </div>
  );
}

export default function AdminCompetitionPage({ params }: PageProps) {
  return (
    <div className="shell py-8">
      <Suspense fallback={<CompetitionFallback />}>
        <CompetitionContent params={params} />
      </Suspense>
    </div>
  );
}
