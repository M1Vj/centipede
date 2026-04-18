import { notFound } from "next/navigation";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { BankForm } from "@/components/problem-bank/bank-form";
import { ImportControls } from "@/components/problem-bank/import-controls";
import { ProblemList } from "@/components/problem-bank/problem-list";
import {
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerPrimaryActionClass,
  organizerSecondaryActionClass,
} from "@/components/organizer/workspace-patterns";
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
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        breadcrumbs={[
          { label: "Problem Banks", href: "/organizer/problem-bank" },
          { label: bank.name },
        ]}
        eyebrow={canEdit ? "Problem Bank Editor" : "Shared Problem Bank"}
        title={bank.name}
        description={
          canEdit
            ? "Maintain bank metadata, import CSV rows, and author reusable problems."
            : "This is a read-only default bank visible to organizers."
        }
        actions={
          <>
            <ProgressLink href="/organizer/problem-bank" className={organizerSecondaryActionClass}>
              <ArrowLeft className="size-4" />
              Back
            </ProgressLink>
            {canEdit ? (
              <ProgressLink
                href={`/organizer/problem-bank/${bank.id}/problem/new`}
                className={organizerPrimaryActionClass}
              >
                <PlusCircle className="size-4" />
                Add New Problem
              </ProgressLink>
            ) : null}
          </>
        }
      />

      {canEdit ? (
        <OrganizerWorkspacePanel className="border-amber-200/60 dark:border-amber-700/50">
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
        </OrganizerWorkspacePanel>
      ) : (
        <OrganizerWorkspacePanel className="text-sm text-slate-600 dark:text-slate-300">
          {bank.description || "No description provided."}
        </OrganizerWorkspacePanel>
      )}

      {canEdit ? (
        <OrganizerWorkspacePanel className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import and bulk actions</h2>
          <ImportControls bankId={bank.id} />
        </OrganizerWorkspacePanel>
      ) : null}

      <OrganizerWorkspacePanel className="p-4 md:p-5">
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
      </OrganizerWorkspacePanel>
    </OrganizerWorkspaceShell>
  );
}
