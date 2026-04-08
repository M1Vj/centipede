import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Library, PlusCircle, Trash2 } from "lucide-react";
import { ProblemList } from "@/components/problem-bank/problem-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardSkeletonList, DetailSectionSkeleton } from "@/components/ui/feedback-skeletons";
import { ProgressLink } from "@/components/ui/progress-link";
import { normalizeProblemRow } from "@/lib/problem-bank/api-helpers";
import { deleteProblemBank } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

const PROBLEM_SELECT_COLUMNS =
  "id, bank_id, type, difficulty, tags, content_latex, content, options_json, options, answer_key_json, answers, explanation_latex, authoring_notes, image_path, image_url, is_deleted, created_at, updated_at";

async function ProblemBankContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bank, error } = await supabase
    .from("problem_banks")
    .select(
      `
        id,
        name,
        description,
        organizer_id,
        is_default_bank,
        is_visible_to_organizers,
        is_deleted,
        created_at,
        updated_at,
        profiles!problem_banks_organizer_id_fkey (full_name, email, organization),
        problems (${PROBLEM_SELECT_COLUMNS})
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !bank || bank.is_deleted) {
    notFound();
  }

  const canAuthorDefaultBank = Boolean(bank.is_default_bank);
  const organizerProfile = Array.isArray(bank.profiles)
    ? bank.profiles[0]
    : bank.profiles;

  const normalizedProblems = Array.isArray(bank.problems)
    ? bank.problems
        .map((row) => normalizeProblemRow(row))
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];

  const activeProblems = normalizedProblems.filter((problem) => !problem.isDeleted);

  async function handleDelete() {
    "use server";

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    try {
      await deleteProblemBank(id, user?.id);
    } catch {
      // Keep admin moderation flow deterministic and avoid leaking internals.
    }

    redirect("/admin/problem-banks");
  }

  return (
    <div className="grid gap-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <ProgressLink
          href="/admin/problem-banks"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Problem Banks
        </ProgressLink>

        <form action={handleDelete}>
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="size-4" />
            Soft Delete Bank
          </Button>
        </form>
      </div>

      <Card className="surface-card border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Library className="size-5" />
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight">{bank.name}</CardTitle>
            </div>
            <CardDescription className="mt-3 text-base leading-relaxed">
              {bank.description || "No description provided."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 text-xs font-medium uppercase tracking-wider">
              Problem Bank
            </Badge>
            {bank.is_default_bank ? (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium uppercase tracking-wider">
                Default
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
            <p className="text-sm font-semibold text-foreground">Organizer Information</p>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
              <p>Name: {organizerProfile?.full_name || "Unknown"}</p>
              <p>Email: {organizerProfile?.email || "Unknown"}</p>
              <p>Organization: {organizerProfile?.organization || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">
            Included Problems ({activeProblems.length})
          </h2>
          {canAuthorDefaultBank ? (
            <ProgressLink
              href={`/admin/problem-banks/${bank.id}/problem/new`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              <PlusCircle className="size-4" />
              Create Default Problem
            </ProgressLink>
          ) : null}
        </div>

        {!canAuthorDefaultBank ? (
          <Card className="border-border/60 bg-muted/20">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Non-default banks are read-only for admin authoring. Moderation actions remain available.
            </CardContent>
          </Card>
        ) : null}

        <ProblemList
          title="Problems"
          problems={activeProblems.map((problem) => ({
            id: problem.id,
            type: problem.type,
            difficulty: problem.difficulty,
            tags: problem.tags,
            contentLatex: problem.contentLatex,
            explanationLatex: problem.explanationLatex,
            updatedAt: problem.updatedAt,
          }))}
          problemHrefBase={
            canAuthorDefaultBank ? `/admin/problem-banks/${bank.id}/problem` : undefined
          }
          editable={canAuthorDefaultBank}
        />
      </div>
    </div>
  );
}

function ProblemBankFallback() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
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
