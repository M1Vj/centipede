import { createAdminClient } from "@/lib/supabase/admin";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import {
  COMPETITION_BANK_SELECT_COLUMNS,
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  competitionRecordToFormState,
  normalizeCompetitionBankRecord,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import { normalizeProblemRow } from "@/lib/problem-bank/api-helpers";
import { createClient } from "@/lib/supabase/server";
import type {
  CompetitionBankRecord,
  CompetitionDraftFormState,
  CompetitionProblemOption,
  CompetitionRecord,
} from "@/lib/competition/types";

export interface CompetitionWorkspaceData {
  banks: CompetitionBankRecord[];
  problems: CompetitionProblemOption[];
}

export interface CompetitionEditWorkspaceData extends CompetitionWorkspaceData {
  competition: CompetitionRecord | null;
  selectedProblemIds: string[];
  formState: CompetitionDraftFormState;
}

const PROBLEM_SELECT_COLUMNS =
  "id, bank_id, type, difficulty, tags, content_latex, explanation_latex, authoring_notes, image_path, created_at, updated_at, is_deleted";

type CompetitionProblemsClient = {
  from: (table: "competition_problems") => {
    select: (columns: string) => {
      eq: (column: "competition_id", value: string) => {
        order: (column: "order_index", options: { ascending: boolean }) => Promise<{
          data: Array<{ problem_id: unknown }> | null;
          error: unknown;
        }>;
      };
    };
  };
};

function normalizeSelectedProblemIds(rows: Array<{ problem_id: unknown }> | null) {
  return (rows ?? [])
    .map((row) => row.problem_id)
    .filter((problemId): problemId is string => typeof problemId === "string");
}

async function readSelectedProblemIds(
  client: CompetitionProblemsClient,
  competitionId: string,
) {
  const result = await client
    .from("competition_problems")
    .select("problem_id, order_index")
    .eq("competition_id", competitionId)
    .order("order_index", { ascending: true });

  return {
    selectedProblemIds: normalizeSelectedProblemIds(result.data),
    error: result.error,
  };
}

async function loadSelectedProblemIds(
  client: CompetitionProblemsClient,
  competitionId: string,
) {
  const scopedResult = await readSelectedProblemIds(client, competitionId);
  if (!scopedResult.error && scopedResult.selectedProblemIds.length > 0) {
    return scopedResult.selectedProblemIds;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return scopedResult.selectedProblemIds;
  }

  const adminResult = await readSelectedProblemIds(
    adminClient as unknown as CompetitionProblemsClient,
    competitionId,
  );
  if (!adminResult.error && (adminResult.selectedProblemIds.length > 0 || scopedResult.error)) {
    return adminResult.selectedProblemIds;
  }

  return scopedResult.selectedProblemIds;
}

async function loadCompetitionBanksAndProblems() {
  const supabase = await createClient();

  const [{ data: bankRows, error: bankError }, { data: problemRows, error: problemError }] = await Promise.all([
    supabase
      .from("problem_banks")
      .select(COMPETITION_BANK_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .order("name", { ascending: true }),
    supabase
      .from("problems")
      .select(PROBLEM_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false }),
  ]);

  const banks = !bankError
    ? (bankRows ?? [])
        .map((row) => normalizeCompetitionBankRecord(row))
        .filter((row): row is CompetitionBankRecord => row !== null)
    : [];

  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));
  const problems = !problemError
    ? (problemRows ?? [])
        .map((row) => {
          const problem = normalizeProblemRow(row);
          if (!problem) {
            return null;
          }

          return {
            ...problem,
            bankName: bankNames.get(problem.bankId) ?? "Unknown bank",
          };
        })
        .filter((row): row is CompetitionProblemOption => row !== null)
    : [];

  return {
    banks,
    problems,
  };
}

export async function loadCompetitionCreateWorkspaceData(): Promise<CompetitionWorkspaceData> {
  return loadCompetitionBanksAndProblems();
}

export async function loadCompetitionEditWorkspaceData(
  competitionId: string,
  organizerId: string,
): Promise<CompetitionEditWorkspaceData> {
  const supabase = await createClient();
  const [workspace, primaryCompetitionResult] = await Promise.all([
    loadCompetitionBanksAndProblems(),
    supabase
      .from("competitions")
      .select(COMPETITION_SELECT_COLUMNS)
      .eq("id", competitionId)
      .eq("organizer_id", organizerId)
      .maybeSingle(),
  ]);

  const fallbackCompetitionResult =
    primaryCompetitionResult.error && isLegacyCompetitionSelectError(primaryCompetitionResult.error)
      ? await supabase
          .from("competitions")
          .select(LEGACY_COMPETITION_SELECT_COLUMNS)
          .eq("id", competitionId)
          .eq("organizer_id", organizerId)
          .maybeSingle()
      : null;

  const competitionResult = fallbackCompetitionResult ? fallbackCompetitionResult : primaryCompetitionResult;
  const competition = competitionResult.error ? null : normalizeCompetitionRecord(competitionResult.data);

  if (!competition) {
    return {
      ...workspace,
      competition: null,
      selectedProblemIds: [],
      formState: createDefaultCompetitionDraftState(),
    };
  }

  const selectedProblemIds = await loadSelectedProblemIds(
    supabase as unknown as CompetitionProblemsClient,
    competitionId,
  );

  return {
    ...workspace,
    competition,
    selectedProblemIds,
    formState: competition ? competitionRecordToFormState(competition, selectedProblemIds) : createDefaultCompetitionDraftState(),
  };
}

export async function loadOrganizerCompetitionForManagement(
  competitionId: string,
  organizerId: string,
): Promise<CompetitionRecord | null> {
  const supabase = await createClient();
  const primaryResult = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .eq("organizer_id", organizerId)
    .maybeSingle();

  const fallbackResult =
    primaryResult.error && isLegacyCompetitionSelectError(primaryResult.error)
      ? await supabase
          .from("competitions")
          .select(LEGACY_COMPETITION_SELECT_COLUMNS)
          .eq("id", competitionId)
          .eq("organizer_id", organizerId)
          .maybeSingle()
      : null;

  const result = fallbackResult ? fallbackResult : primaryResult;
  if (result.error) {
    return null;
  }

  const competition = normalizeCompetitionRecord(result.data);
  return competition && !competition.isDeleted ? competition : null;
}
