import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, FileUp, Pencil, PlusCircle, TrendingUp } from "lucide-react";
import { BankForm } from "@/components/problem-bank/bank-form";
import { ImportControls } from "@/components/problem-bank/import-controls";
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
            <ProgressLink
              href="/organizer/problem-bank"
              className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-slate-500" /> Back
            </ProgressLink>
            {canEdit && (
              <>
                <ProgressLink
                  href={`/organizer/problem-bank/${bank.id}/problem/new`}
                  className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-5 py-2.5 rounded-xl font-bold text-[14px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-5 h-5" /> Add New Problem
                </ProgressLink>
              </>
            )}
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                Bank Status
              </div>
              <div className="text-[20px] font-black text-[#10182b] leading-none">
                {canEdit ? "Authored" : "Read-only"}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details / Edit Form */}
        {canEdit ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm w-full mb-8">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#10182b]">Bank Details</h2>
                <p className="text-slate-500 text-[14px]">Edit bank name and description</p>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[13px] font-medium">
                <Pencil className="w-4 h-4" /> Editing
              </div>
            </div>
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
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm w-full mb-8">
            <h2 className="text-xl font-bold text-[#10182b] mb-3">About this Bank</h2>
            <p className="text-slate-600 text-[15px] leading-relaxed">
              {bank.description || "No description provided."}
            </p>
          </div>
        )}

        {/* Import Controls */}
        {canEdit && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm w-full mb-8">
            <div className="mb-6 flex items-center gap-3">
              <FileUp className="w-5 h-5 text-slate-400" />
              <div>
                <h2 className="text-xl font-bold text-[#10182b]">Import & Bulk Actions</h2>
                <p className="text-slate-500 text-[14px]">Download the CSV template, populate rows, and import.</p>
              </div>
            </div>
            <ImportControls bankId={bank.id} />
          </div>
        )}

        {/* Problem List */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm w-full">
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
        </div>

      </div>
    </div>
  );
}


