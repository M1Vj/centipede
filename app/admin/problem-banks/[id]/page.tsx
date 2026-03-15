import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProblemBank } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Library } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { DetailSectionSkeleton, CardSkeletonList } from "@/components/ui/feedback-skeletons";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function ProblemBankContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch bank details including problems
  const { data: bank, error } = await supabase
    .from("problem_banks")
    .select(`
      *,
      profiles!problem_banks_organizer_id_fkey (full_name, email, organization),
      problems (*)
    `)
    .eq("id", id)
    .single();

  if (error || !bank || bank.is_deleted) {
    notFound();
  }

  async function handleDelete() {
    "use server";
    try {
      await deleteProblemBank(id);
    } catch (err) {
      console.error("Failed to delete problem bank:", err);
    }
    redirect("/admin/problem-banks");
  }

  return (
    <div className="grid gap-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <ProgressLink
          href="/admin/problem-banks"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Problem Banks
        </ProgressLink>

        <form action={handleDelete}>
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="size-4" />
            Delete Bank
          </Button>
        </form>
      </div>

      <div className="grid gap-6">
        <Card className="surface-card border-border/60">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Library className="size-5" />
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight">
                  {bank.name}
                </CardTitle>
              </div>
              <CardDescription className="mt-3 text-base leading-relaxed">
                {bank.description || "No description provided."}
              </CardDescription>
            </div>
            <Badge variant="outline" className="px-3 py-1 text-xs font-medium uppercase tracking-wider">
              Problem Bank
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
              <p className="text-sm font-semibold text-foreground">Organizer Information</p>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                <p>Name: {bank.profiles?.full_name}</p>
                <p>Email: {bank.profiles?.email}</p>
                <p>Organization: {bank.profiles?.organization || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <h2 className="text-xl font-bold tracking-tight">Included Problems ({bank.problems?.length || 0})</h2>
          {bank.problems && bank.problems.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {bank.problems.map((problem: { id: string; type: string; difficulty: string; content: string; tags: string[] | null }) => (
                <Card key={problem.id} className="border-border/50 bg-background/50 hover:border-border/80 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tighter">
                        {problem.type}
                      </Badge>
                      <Badge className="text-[10px] uppercase font-bold tracking-tighter">
                        {problem.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-3 text-muted-foreground">
                      {problem.content}
                    </div>
                    {problem.tags && problem.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {problem.tags.map((tag: string) => (
                          <span key={tag} className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-center p-8">
              <p className="text-muted-foreground">This bank contains no problems.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProblemBankFallback() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="h-9 w-24 bg-muted animate-pulse rounded" />
      </div>
      <DetailSectionSkeleton lines={3} />
      <CardSkeletonList count={4} />
    </div>
  );
}

export default function AdminProblemBankPage({ params }: PageProps) {
  return (
    <div className="shell py-8">
      <Suspense fallback={<ProblemBankFallback />}>
        <ProblemBankContent params={params} />
      </Suspense>
    </div>
  );
}
