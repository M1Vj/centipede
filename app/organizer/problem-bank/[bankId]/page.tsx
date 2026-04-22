import { notFound } from "next/navigation";
import { BookOpen, ChevronRight, Plus, TrendingUp } from "lucide-react";
import { EditBankModal } from "@/components/problem-bank/edit-bank-modal";
import { ImportCsvModal } from "@/components/problem-bank/import-csv-modal";
import { ProblemList } from "@/components/problem-bank/problem-list";
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

  // Derive avg difficulty label
  const difficultyScore = problems.reduce((acc, p) => {
    if (p.difficulty === "easy") return acc + 1;
    if (p.difficulty === "average") return acc + 2;
    return acc + 3;
  }, 0);
  const avgScore = problems.length > 0 ? difficultyScore / problems.length : 0;
  const avgDifficultyLabel =
    avgScore === 0 ? "—" : avgScore <= 1.5 ? "Easy" : avgScore <= 2.5 ? "Average" : "Difficult";

  return (
    <div className="w-full flex flex-col items-center pb-12 px-4 font-['Poppins']">
      <div className="w-full max-w-[1024px] mt-12 flex flex-col">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-slate-500 font-medium text-[14px] mb-2">
          <ProgressLink href="/organizer/problem-bank" className="hover:text-[#10182b] transition-colors">
            Problem Banks
          </ProgressLink>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[#10182b] font-bold">{bank.name}</span>
        </div>

        {/* Page Header & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="flex-1 max-w-[600px] pr-4">
            <h1 className="text-3xl md:text-[34px] font-black text-[#10182b] tracking-tight leading-tight mb-2">
              {bank.name}
            </h1>
            <p className="text-slate-600 text-[15px] font-medium leading-relaxed">
              {canEdit
                ? (bank.description || "Manage and organize your curriculum content here.")
                : "This is a read-only default bank visible to organizers."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {canEdit && (
              <>
                <EditBankModal
                  bank={{
                    id: bank.id,
                    name: bank.name,
                    description: bank.description,
                    updatedAt: bank.updatedAt,
                  }}
                />
                <ImportCsvModal bankId={bank.id} />
                <ProgressLink
                  href={`/organizer/problem-bank/${bank.id}/problem/new`}
                  className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-5 py-2.5 rounded-xl font-bold text-[14px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-5 h-5" /> Add New Problem
                </ProgressLink>
              </>
            )}
          </div>
        </div>

        {/* Problem List Table Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm w-full mb-6">
          <ProblemList
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
        </div>

        {/* Bottom Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 flex items-center gap-6 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#10182b] shrink-0">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-1">
                Total Problems
              </div>
              <div className="text-[32px] font-black text-[#10182b] leading-none">
                {problems.length}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 flex items-center gap-6 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#f49700]/10 border border-[#f49700]/20 flex items-center justify-center text-[#e08900] shrink-0">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <div className="text-slate-400 text-[11px] font-black uppercase tracking-wider mb-1">
                Avg. Difficulty
              </div>
              <div className="text-[32px] font-black text-[#10182b] leading-none">
                {avgDifficultyLabel}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
