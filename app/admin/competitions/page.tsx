import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, User, ArrowRight, Calendar, Users, Pause, Play } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

async function CompetitionsList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-muted-foreground">Syncing competition directory...</div>;

  const { data: competitions, error } = await admin
    .from("competitions")
    .select(`
      *,
      profiles!competitions_organizer_id_fkey (full_name, organization)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load competitions.</div>;
  }

  if (!competitions || competitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <Trophy className="size-10 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No competitions found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {competitions.map((comp: any) => (
        <Card key={comp.id} className="surface-card border-border/60 overflow-hidden flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Trophy className="size-5" />
              </div>
              <div className="flex flex-col items-end gap-2">
                 {comp.is_paused ? (
                    <Badge variant="destructive" className="gap-1 animate-pulse text-[10px]">
                      <Pause className="size-2 text-white" />
                      PAUSED
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-500 text-white gap-1 text-[10px] border-0">
                      <Play className="size-2" />
                      ACTIVE
                    </Badge>
                  )}
                  {comp.published && (
                    <Badge variant="outline" className="text-[9px] font-black tracking-tighter uppercase px-1 h-4">
                        Published
                    </Badge>
                  )}
              </div>
            </div>
            <CardTitle className="text-xl font-bold mt-4 line-clamp-1">{comp.name}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
               <Badge variant="secondary" className="text-[10px] capitalize">{comp.type}</Badge>
               <Badge variant="outline" className="text-[10px] capitalize">{comp.format}</Badge>
            </div>
          </CardHeader>
          <CardContent className="mt-auto pt-4 border-t border-border/40">
            <div className="grid grid-cols-2 gap-y-3 mb-6 text-xs text-muted-foreground">
               <div className="flex items-center gap-1.5">
                  <User className="size-3" />
                  <span className="truncate">{comp.profiles?.full_name}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <Calendar className="size-3" />
                  <span>{comp.duration_minutes}m</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <Users className="size-3" />
                  <span>Max: {comp.max_participants || "∞"}</span>
               </div>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full gap-2 font-semibold">
              <ProgressLink href={`/admin/competitions/${comp.id}`}>
                View & Manage
                <ArrowRight className="size-3" />
              </ProgressLink>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="animate-pulse border-border/60 h-72" />
      ))}
    </div>
  );
}

export default function AdminCompetitionsListPage() {
  return (
    <div className="shell py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Competitions Index</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor all scheduled and active events across the Mathwiz platform.
        </p>
      </div>

      <Suspense fallback={<GridSkeleton />}>
        <CompetitionsList />
      </Suspense>
    </div>
  );
}
