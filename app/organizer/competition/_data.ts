import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import {
  COMPETITION_BANK_SELECT_COLUMNS,
  COMPETITION_SELECT_COLUMNS,
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
  "id, bank_id, type, difficulty, tags, content_latex, content, options_json, options, answer_key_json, answers, explanation_latex, authoring_notes, image_path, image_url, created_at, updated_at, is_deleted";

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

export async function loadCompetitionEditWorkspaceData(competitionId: string): Promise<CompetitionEditWorkspaceData> {
  const supabase = await createClient();
  const [workspace, competitionResult, selectedResult] = await Promise.all([
    loadCompetitionBanksAndProblems(),
    supabase
      .from("competitions")
      .select(COMPETITION_SELECT_COLUMNS)
      .eq("id", competitionId)
      .maybeSingle(),
    supabase
      .from("competition_problems")
      .select("problem_id, order_index")
      .eq("competition_id", competitionId)
      .order("order_index", { ascending: true }),
  ]);

  const competition = competitionResult.error ? null : normalizeCompetitionRecord(competitionResult.data);
  const selectedProblemIds = selectedResult.error
    ? []
    : (selectedResult.data ?? [])
        .map((row) => row.problem_id)
        .filter((problemId): problemId is string => typeof problemId === "string");

  return {
    ...workspace,
    competition,
    selectedProblemIds,
    formState: competition ? competitionRecordToFormState(competition, selectedProblemIds) : createDefaultCompetitionDraftState(),
  };
}
