import type { ArenaAttemptAnswer, ArenaProblem } from "@/lib/arena/types";
import type { AttemptGradingMode } from "@/lib/scoring/types";

export interface ReviewProblemInput {
  competitionProblemId: string;
  orderIndex: number;
  points: number | null;
}

export interface AttemptReviewRow {
  competitionProblemId: string;
  problemNumber: number;
  points: number | null;
  statusFlag: ArenaAttemptAnswer["statusFlag"];
  answered: boolean;
}

export interface ReviewStatusCounts {
  total: number;
  blank: number;
  filled: number;
  solved: number;
  reset: number;
  answered: number;
}

export function buildAttemptReviewRows({
  problems,
  answers,
}: {
  problems: Array<ReviewProblemInput | ArenaProblem>;
  answers: ArenaAttemptAnswer[];
}): AttemptReviewRow[] {
  const answersByProblemId = new Map(answers.map((answer) => [answer.competitionProblemId, answer]));

  return problems.map((problem, index) => {
    const answer = answersByProblemId.get(problem.competitionProblemId);
    const statusFlag = answer?.statusFlag ?? "blank";

    return {
      competitionProblemId: problem.competitionProblemId,
      problemNumber: problem.orderIndex || index + 1,
      points: problem.points,
      statusFlag,
      answered: statusFlag === "filled" || statusFlag === "solved",
    };
  });
}

export function countReviewStatuses(rows: AttemptReviewRow[]): ReviewStatusCounts {
  return rows.reduce<ReviewStatusCounts>(
    (counts, row) => {
      counts.total += 1;
      counts[row.statusFlag] += 1;
      if (row.answered) {
        counts.answered += 1;
      }
      return counts;
    },
    {
      total: 0,
      blank: 0,
      filled: 0,
      solved: 0,
      reset: 0,
      answered: 0,
    },
  );
}

export function getResultPolicyCopy(mode: AttemptGradingMode) {
  switch (mode) {
    case "latest_score":
      return "Leaderboard and history use latest attempt score for this open competition.";
    case "average_score":
      return "Leaderboard and history use average score across submitted attempts for this open competition.";
    default:
      return "Leaderboard and history use highest score across submitted attempts for this open competition.";
  }
}
