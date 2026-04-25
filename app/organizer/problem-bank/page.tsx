import { ArrowRight, Calendar, Edit3, FileText, Library, PlusCircle } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { normalizeProblemBankRow } from "@/lib/problem-bank/api-helpers";
import { createClient } from "@/lib/supabase/server";

type ProblemBankPageSearchParams = {
  tab?: string | string[];
};

type ProblemBankRow = Record<string, unknown> & {
  problems?: Array<{ count?: number | null }>;
};

export default async function OrganizerProblemBankPage(props: {
  searchParams?: Promise<ProblemBankPageSearchParams> | ProblemBankPageSearchParams;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const supabase = await createClient();

  const resolvedParams = (await props.searchParams) || {};
  const tab = typeof resolvedParams.tab === "string" ? resolvedParams.tab : "all";

  const { data, error } = await supabase
    .from("problem_banks")
    .select(
      "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at, problems(count)",
    )
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const banks = !error
    ? (data ?? [])
        .map((row: ProblemBankRow) => {
          const normalized = normalizeProblemBankRow(row);
          if (!normalized) return null;
          return {
            ...normalized,
            problemCount: Array.isArray(row.problems) ? row.problems[0]?.count ?? 0 : 0,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];

  const ownBanks = banks.filter(
    (bank) => bank.organizerId === profile?.id && !bank.isDefaultBank,
  );
  const defaultBanks = banks.filter((bank) => bank.isDefaultBank && bank.isVisibleToOrganizers);

  return (
    <div className="w-full flex flex-col items-center pb-12 px-4 font-['Poppins']">
      <div className="w-full max-w-[1024px] mt-12 flex flex-col">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-[34px] font-black text-[#10182b] tracking-tight leading-tight mb-2">
              Problem Banks
            </h1>
            <p className="text-slate-600 text-[15px] font-medium">
              Manage your curated collections of mathematical problems and assessments.
            </p>
          </div>
          <ProgressLink 
            href="/organizer/problem-bank/create"
            className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-6 py-3.5 rounded-xl font-bold text-[15px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center justify-center gap-2 self-start md:self-auto"
          >
            <PlusCircle className="w-5 h-5" /> Add Problem Bank
          </ProgressLink>
        </div>

        {/* Filter Pills (Adapted from target design Tabs & existing logic) */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <ProgressLink
            href="/organizer/problem-bank?tab=all"
            className={`px-5 py-2.5 rounded-full text-[14px] font-bold transition-all ${tab === "all" ? "bg-[#10182b] text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-[#10182b]"}`}
          >
            All Banks
          </ProgressLink>
          <ProgressLink
            href="/organizer/problem-bank?tab=my-banks"
            className={`px-5 py-2.5 rounded-full text-[14px] font-bold transition-all ${tab === "my-banks" ? "bg-[#10182b] text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-[#10182b]"}`}
          >
            My Banks
          </ProgressLink>
          <ProgressLink
            href="/organizer/problem-bank?tab=shared"
            className={`px-5 py-2.5 rounded-full text-[14px] font-bold transition-all ${tab === "shared" ? "bg-[#10182b] text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-[#10182b]"}`}
          >
            Shared with me
          </ProgressLink>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl mb-8 font-medium">
            Unable to load problem banks.
          </div>
        ) : null}

        {/* My Banks Section */}
        { (tab === "all" || tab === "my-banks") && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm w-full mb-8">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-2xl font-black text-[#10182b]">My Banks</h2>
              <span className="text-[13px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{ownBanks.length} banks</span>
            </div>

            {ownBanks.length === 0 ? (
              <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500 font-medium">
                You have not created any banks yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownBanks.map((bank) => (
                  <div 
                    key={bank.id} 
                    className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col h-[320px] group hover:border-[#f49700]/50 hover:shadow-md transition-all duration-300"
                  >
                    <div className="mb-4">
                      <span className="inline-block bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase mb-4">
                        AUTHORED
                      </span>
                      <h3 className="font-bold text-[#10182b] text-[20px] leading-snug mb-3 line-clamp-2">
                        {bank.name}
                      </h3>
                      <p className="text-slate-500 text-[14px] leading-relaxed line-clamp-3">
                        {bank.description || "No description provided."}
                      </p>
                    </div>
                    
                    <div className="mt-auto">
                      <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[12px] font-semibold mb-5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4" /> {bank.problemCount} Problems
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" /> Updated {new Date(bank.updatedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <ProgressLink 
                        href={`/organizer/problem-bank/${bank.id}`}
                        className="w-full bg-[#f49700] hover:bg-[#e08900] text-[#10182b] py-3 rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        Manage Bank <Edit3 className="w-4 h-4" />
                      </ProgressLink>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Visible Default Banks Section */}
        { (tab === "all" || tab === "shared") && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm w-full">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-2xl font-black text-[#10182b]">Visible Default Banks</h2>
              <span className="text-[13px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{defaultBanks.length} shared</span>
            </div>

            {defaultBanks.length === 0 ? (
              <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500 font-medium">
                No default banks are currently visible to organizers.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {defaultBanks.map((bank) => (
                  <div 
                    key={bank.id} 
                    className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-300 p-6 flex flex-col h-[320px] group hover:border-slate-400 transition-all duration-300 opacity-90 hover:opacity-100"
                  >
                    <div className="mb-4">
                      <span className="inline-flex items-center gap-1.5 bg-[#1a1e2e]/10 text-[#1a1e2e] px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase mb-4">
                        <Library className="w-3 h-3" /> DEFAULT
                      </span>
                      <h3 className="font-bold text-[#10182b] text-[20px] leading-snug mb-3 line-clamp-2 opacity-90">
                        {bank.name}
                      </h3>
                      <p className="text-slate-500 text-[14px] leading-relaxed line-clamp-3">
                        {bank.description || "No description provided."}
                      </p>
                    </div>

                    <div className="mt-auto">
                      <div className="flex flex-wrap items-center gap-4 text-slate-400 text-[12px] font-semibold mb-5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4" /> {bank.problemCount} Problems
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" /> Updated {new Date(bank.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <ProgressLink 
                        href={`/organizer/problem-bank/${bank.id}`}
                        className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        Browse <ArrowRight className="w-4 h-4" />
                      </ProgressLink>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
