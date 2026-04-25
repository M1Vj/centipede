import { PlusCircle, Trophy } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { CompetitionCardGrid } from "@/components/organizer/competition-card-grid";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import { startDueScheduledCompetitionsSafely } from "@/lib/competition/scheduled-start";
import type { CompetitionRecord } from "@/lib/competition/types";

export default async function OrganizerCompetitionPage() {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const supabase = await createClient();

  await startDueScheduledCompetitionsSafely();

  const primaryResult = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("organizer_id", profile?.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const fallbackResult =
    primaryResult.error && isLegacyCompetitionSelectError(primaryResult.error)
      ? await supabase
        .from("competitions")
        .select(LEGACY_COMPETITION_SELECT_COLUMNS)
        .eq("organizer_id", profile?.id)
        .order("created_at", { ascending: false })
      : null;

  const data = fallbackResult ? fallbackResult.data : primaryResult.data;
  const error = fallbackResult ? fallbackResult.error : primaryResult.error;

  const competitions = !error
    ? (data ?? [])
        .map((row) => normalizeCompetitionRecord(row))
        .filter((row): row is CompetitionRecord => row !== null && !row.isDeleted)
    : [];

  return (
    <div className="w-full flex justify-center px-4">
      <div className="w-full max-w-[1024px] mt-12 flex flex-col pb-12 font-['Poppins']">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-[34px] font-black text-[#10182b] tracking-tight leading-tight mb-2">
              Competition Dashboard
            </h1>
            <p className="text-slate-600 text-[15px] font-medium">
              Overview of your active and upcoming mathematical events.
            </p>
          </div>
          <ProgressLink
            href="/organizer/competition/create"
            className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-6 py-3.5 rounded-xl font-bold text-[15px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2 self-start md:self-auto no-underline"
          >
            <PlusCircle className="w-5 h-5" /> Create New Competition
          </ProgressLink>
        </div>

        {/* Error state */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 mb-8">
            Unable to load competitions. Please try again later.
          </div>
        ) : null}

        {/* Empty state (no competitions at all) */}
        {!error && competitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-6">
              <Trophy className="w-9 h-9" />
            </div>
            <h2 className="font-bold text-[#10182b] text-xl mb-2">
              No competitions yet
            </h2>
            <p className="text-slate-500 text-[14px] max-w-md mb-6">
              Create your first competition to begin schedule setup, problem selection, and scoring configuration.
            </p>
            <ProgressLink
              href="/organizer/competition/create"
              className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-6 py-3 rounded-xl font-bold text-[14px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2 no-underline"
            >
              <PlusCircle className="w-5 h-5" /> Create Draft
            </ProgressLink>
          </div>
        ) : null}

        {/* Competitions Grid */}
        {!error && competitions.length > 0 ? (
          <CompetitionCardGrid competitions={competitions} />
        ) : null}
      </div>
    </div>
  );
}
