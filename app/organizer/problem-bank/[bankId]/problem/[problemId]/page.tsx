import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerSecondaryActionClass,
} from "@/components/organizer/workspace-patterns";
import { ProblemForm } from "@/components/problem-bank/problem-form";
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
  params: Promise<{ bankId: string; problemId: string }>;
}

const PROBLEM_SELECT_COLUMNS =
  "id, bank_id, type, difficulty, tags, content_latex, content, options_json, options, answer_key_json, answers, explanation_latex, authoring_notes, image_path, image_url, created_at, updated_at";

export default async function OrganizerProblemEditorPage({ params }: PageProps) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { bankId, problemId } = await params;

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
  if (!canEdit) {
    notFound();
  }

  let initialValue: {
    id: string;
    type: "mcq" | "tf" | "numeric" | "identification";
    difficulty: "easy" | "average" | "difficult";
    tags: string[];
    contentLatex: string;
    explanationLatex: string;
    authoringNotes: string;
    imagePath: string | null;
    imageUrl: string | null;
    options: { id: string; label: string }[] | null;
    answerKey:
      | { correctOptionIds: string[] }
      | { acceptedAnswer: "true" | "false" }
      | { acceptedAnswers: string[] };
    updatedAt: string;
  } | null = null;

  if (problemId !== "new") {
    const { data: problemData, error: problemError } = await supabase
      .from("problems")
      .select(PROBLEM_SELECT_COLUMNS)
      .eq("bank_id", bankId)
      .eq("id", problemId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (problemError) {
      notFound();
    }

    const problem = normalizeProblemRow(problemData);
    if (!problem) {
      notFound();
    }

    const imageUrl = problem.imagePath
      ? (
          await supabase.storage
            .from("problem-assets")
            .createSignedUrl(problem.imagePath, 60 * 30)
        ).data?.signedUrl ?? null
      : null;

    initialValue = {
      id: problem.id,
      type: problem.type,
      difficulty: problem.difficulty,
      tags: problem.tags,
      contentLatex: problem.contentLatex,
      explanationLatex: problem.explanationLatex,
      authoringNotes: problem.authoringNotes,
      imagePath: problem.imagePath,
      imageUrl,
      options: problem.options,
      answerKey: problem.answerKey,
      updatedAt: problem.updatedAt,
    };
  }

  const isCreateMode = problemId === "new";

  return (
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        breadcrumbs={[
          { label: "Problem Banks", href: "/organizer/problem-bank" },
          { label: bank.name, href: `/organizer/problem-bank/${bank.id}` },
          { label: isCreateMode ? "Add Problem" : "Edit Problem" },
        ]}
        eyebrow="Problem Authoring"
        title={isCreateMode ? "Add Problem" : "Edit Problem"}
        description={
          isCreateMode
            ? "Create a new problem for this bank using validated math-authoring inputs."
            : "Update problem content, options, answer keys, and metadata."
        }
        actions={
          <ProgressLink href={`/organizer/problem-bank/${bank.id}`} className={organizerSecondaryActionClass}>
            <ArrowLeft className="size-4" />
            Back to bank
          </ProgressLink>
        }
      />

      <OrganizerWorkspacePanel className="border-amber-200/60 p-3 md:p-4 dark:border-amber-700/50">
        <ProblemForm
          bankId={bank.id}
          backHref={`/organizer/problem-bank/${bank.id}`}
          initialValue={initialValue}
          editable
        />
      </OrganizerWorkspacePanel>
    </OrganizerWorkspaceShell>
  );
}
