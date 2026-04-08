import { notFound } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { BankForm } from "@/components/problem-bank/bank-form";
import { ImportControls } from "@/components/problem-bank/import-controls";
import { ProblemList } from "@/components/problem-bank/problem-list";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  canViewBank,
  normalizeProblemBankRow,
  normalizeProblemRow,
  type ProblemBankActorContext,
} from "@/lib/problem-bank/api-helpers";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ bankId: string }>;
}

const PROBLEM_SELECT_COLUMNS =
  "id, bank_id, type, difficulty, tags, content_latex, content, options_json, options, answer_key_json, answers, explanation_latex, authoring_notes, image_path, image_url, created_at, updated_at";

export default async function OrganizerProblemBankDetailPage({ params }: PageProps) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { bankId } = await params;

  const supabase = await createClient();
  const { data: bankData, error: bankError } = await supabase
    .from("problem_banks")
    .select(
      "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at",
    )
    .eq("id", bankId)
    .maybeSingle();

  if (bankError) {
    notFound();
  }

  const bank = normalizeProblemBankRow(bankData);
  if (!bank || bank.isDeleted) {
    notFound();
  }

  const actor: ProblemBankActorContext = {
    userId: profile?.id ?? "",
    role: "organizer",
    isActive: profile?.is_active !== false,
  };

  if (!canViewBank(actor, bank)) {
    notFound();
  }

  const canEdit = bank.organizerId === profile?.id && !bank.isDefaultBank;

  const { data: problemRows, error: problemsError } = await supabase
    .from("problems")
    .select(PROBLEM_SELECT_COLUMNS)
    .eq("bank_id", bank.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const problems = !problemsError
    ? (problemRows ?? [])
        .map((row) => normalizeProblemRow(row))
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];

  return (
    <section className="shell py-12 space-y-8">
      <div className="space-y-2">
        <ProgressLink
          href="/organizer/problem-bank"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Back to problem banks
        </ProgressLink>
        <h1 className="text-3xl font-semibold tracking-tight">{bank.name}</h1>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Maintain bank metadata, import CSV rows, and author reusable problems."
            : "This is a read-only default bank visible to organizers."}
        </p>
      </div>

      {canEdit ? (
        <BankForm
          mode="edit"
          initialValue={{
            id: bank.id,
            name: bank.name,
            description: bank.description,
            updatedAt: bank.updatedAt,
          }}
          successRedirectHref="/organizer/problem-bank"
        />
      ) : (
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {bank.description || "No description provided."}
          </CardContent>
        </Card>
      )}

      {canEdit ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Author problems</h2>
            <ProgressLink
              href={`/organizer/problem-bank/${bank.id}/problem/new`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              <PlusCircle className="size-4" />
              Create problem
            </ProgressLink>
          </div>
          <ImportControls bankId={bank.id} />
        </div>
      ) : null}

      <ProblemList
        title="Problems"
        problems={problems.map((problem) => ({
          id: problem.id,
          type: problem.type,
          difficulty: problem.difficulty,
          tags: problem.tags,
          contentLatex: problem.contentLatex,
          explanationLatex: problem.explanationLatex,
          updatedAt: problem.updatedAt,
        }))}
        problemHrefBase={canEdit ? `/organizer/problem-bank/${bank.id}/problem` : undefined}
        editable={canEdit}
      />
    </section>
  );
}
