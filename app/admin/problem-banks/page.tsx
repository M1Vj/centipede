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
import { Library, User, ArrowRight } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

async function BanksList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-muted-foreground">Checking bank index permissions...</div>;

  const { data: banks, error } = await admin
    .from("problem_banks")
    .select(`
      *,
      profiles!problem_banks_organizer_id_fkey (full_name, organization),
      problems (count)
    `)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load problem banks.</div>;
  }

  if (!banks || banks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <Library className="size-10 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No problem banks discovered.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {banks.map((bank) => (
        <Card key={bank.id} className="surface-card border-border/60 overflow-hidden flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Library className="size-5" />
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">
                {bank.problems?.[0]?.count || 0} Problems
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold mt-4 line-clamp-1">{bank.name}</CardTitle>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">
              {bank.description || "No description provided."}
            </p>
          </CardHeader>
          <CardContent className="mt-auto pt-4 border-t border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <User className="size-3" />
              <span className="font-medium text-foreground">{bank.profiles?.full_name}</span>
              <span className="opacity-50">•</span>
              <span className="truncate">{bank.profiles?.organization || "Independent"}</span>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <ProgressLink href={`/admin/problem-banks/${bank.id}`}>
                Moderate Bank
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
        <Card key={i} className="animate-pulse border-border/60 h-64" />
      ))}
    </div>
  );
}

export default function AdminProblemBanksListPage() {
  return (
    <div className="shell py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Problem Banks</h1>
        <p className="mt-2 text-muted-foreground">
          Browse and moderate all question repositories created by organizers.
        </p>
      </div>

      <Suspense fallback={<GridSkeleton />}>
        <BanksList />
      </Suspense>
    </div>
  );
}
