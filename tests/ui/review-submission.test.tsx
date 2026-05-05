// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AnswerKeyView } from "@/components/answer-key/answer-key-view";
import { ReviewSubmissionView } from "@/components/review/review-submission-view";
import type { AnswerKeyPageData, ReviewSubmissionPageData } from "@/lib/submission/types";

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
});

function buildReviewData(): ReviewSubmissionPageData {
  return {
    competition: {
      id: "competition-1",
      name: "National Math Sprint",
      type: "open",
      status: "live",
      attemptsAllowed: 3,
      multiAttemptGradingMode: "latest_score",
    },
    attempt: {
      id: "attempt-1",
      attemptNo: 2,
      status: "in_progress",
      submittedAt: null,
      finalScore: null,
      rawScore: null,
      penaltyScore: null,
      gradedAt: null,
    },
    attemptsRemaining: 1,
    summaryCounts: {
      total: 4,
      blank: 1,
      filled: 1,
      solved: 1,
      reset: 1,
    },
    problems: [
      {
        competitionProblemId: "cp-1",
        orderIndex: 1,
        points: 4,
        type: "numeric",
        contentLatex: "2+2",
        answerLatex: "",
        answerTextNormalized: "",
        statusFlag: "blank",
      },
      {
        competitionProblemId: "cp-2",
        orderIndex: 2,
        points: 5,
        type: "identification",
        contentLatex: "Name x",
        answerLatex: "x",
        answerTextNormalized: "x",
        statusFlag: "filled",
      },
      {
        competitionProblemId: "cp-3",
        orderIndex: 3,
        points: 3,
        type: "mcq",
        contentLatex: "Pick one",
        answerLatex: "",
        answerTextNormalized: "opt_a",
        statusFlag: "solved",
      },
      {
        competitionProblemId: "cp-4",
        orderIndex: 4,
        points: 3,
        type: "tf",
        contentLatex: "True?",
        answerLatex: "",
        answerTextNormalized: "",
        statusFlag: "reset",
      },
    ],
  };
}

function buildAnswerKeyData(): AnswerKeyPageData {
  return {
    competition: {
      id: "competition-1",
      name: "National Math Sprint",
      answerKeyVisibility: "after_end",
      status: "ended",
    },
    attempt: {
      id: "attempt-1",
      attemptNo: 1,
      finalScore: 8,
    },
    canViewAnswerKey: true,
    canDispute: true,
    problems: [
      {
        competitionProblemId: "cp-1",
        orderIndex: 1,
        points: 4,
        type: "numeric",
        contentLatex: "2+2",
        explanationLatex: "Add two pairs.",
        answerKeyLatex: ["4", "04"],
        existingDisputeStatus: null,
      },
    ],
  };
}

describe("review submission UI", () => {
  test("renders persisted summary counts and accessible problem jump links", () => {
    render(<ReviewSubmissionView data={buildReviewData()} />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("Blank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Filled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Solved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reset").length).toBeGreaterThan(0);

    const nav = screen.getByRole("navigation", { name: "Problem jump links" });
    expect(within(nav).getByRole("link", { name: "Problem 3 solved" })).toHaveAttribute(
      "href",
      "/mathlete/competition/competition-1#problem-cp-3",
    );
  });

  test("prevents double submit and shows open-attempt grading policy result copy", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            attempt: {
              id: "attempt-1",
              attemptNo: 2,
              status: "graded",
              submittedAt: "2026-05-03T10:00:00.000Z",
              finalScore: 7,
              rawScore: 8,
              penaltyScore: 1,
              gradedAt: "2026-05-03T10:00:01.000Z",
            },
            attemptsRemaining: 1,
          },
        }),
        { status: 200 },
      ),
    );

    render(<ReviewSubmissionView data={buildReviewData()} />);

    fireEvent.click(screen.getByRole("button", { name: "Submit final attempt" }));
    fireEvent.click(screen.getByRole("button", { name: "I understand, submit" }));
    fireEvent.click(screen.getByRole("button", { name: "Submitting" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Score 7")).toBeInTheDocument();
    expect(screen.getAllByText(/Latest attempt policy uses this attempt as official/i)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Attempt Again" })).toHaveAttribute(
      "href",
      "/mathlete/competition/competition-1",
    );
  });
});

describe("answer key UI", () => {
  test("renders snapshot answers with KaTeX and opens accessible dispute dialog", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "created" }), { status: 201 }));

    render(<AnswerKeyView data={buildAnswerKeyData()} />);

    expect(screen.getByText("Answer key")).toBeInTheDocument();
    expect(screen.getByText("Accepted answers")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".katex")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Dispute problem 1" }));
    expect(screen.getByRole("dialog", { name: "Dispute problem 1" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dispute reason"), {
      target: { value: "Accepted answer misses equivalent expression." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit dispute" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Dispute submitted for organizer review/i)).toBeInTheDocument();
  });

  test("renders answer key for registered participant without attempt but disables disputes", () => {
    render(
      <AnswerKeyView
        data={{
          ...buildAnswerKeyData(),
          attempt: null,
          canDispute: false,
        }}
      />,
    );

    expect(screen.getByText("Registered participant")).toBeInTheDocument();
    expect(screen.getByText("No attempt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dispute problem/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Accepted answer 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Accepted answer 2")).toBeInTheDocument();
  });

  test("hydrates existing dispute state after reload", () => {
    render(
      <AnswerKeyView
        data={{
          ...buildAnswerKeyData(),
          problems: [
            {
              ...buildAnswerKeyData().problems[0],
              existingDisputeStatus: "open",
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Dispute open" })).toBeDisabled();
    expect(screen.getByText(/Dispute submitted for organizer review/i)).toBeInTheDocument();
  });
});
