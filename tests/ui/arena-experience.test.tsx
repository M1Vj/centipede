import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ArenaExperience } from "@/components/arena/arena-experience";
import type { ArenaPageData } from "@/lib/arena/types";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

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

vi.mock("@/components/math-editor/mathlive-field", () => ({
  MathliveField: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <label>
      {label}
      <textarea
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  ),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return {};
      },
    }),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  }),
}));

function buildPageData(mode: ArenaPageData["mode"]): ArenaPageData {
  return {
    mode,
    competition: {
      id: "competition-1",
      name: "National Math Sprint",
      description: "A focused arena flow test.",
      instructions: "Read every question carefully.",
      type: "scheduled",
      format: "individual",
      status: mode === "detail_register" ? "published" : "live",
      registrationStart: null,
      registrationEnd: null,
      startTime: "2026-04-22T12:00:00.000Z",
      endTime: "2026-04-22T13:00:00.000Z",
      durationMinutes: 60,
      attemptsAllowed: 1,
      participantsPerTeam: null,
      logTabSwitch: true,
      safeExamBrowserMode: "off",
    },
    registration:
      mode === "detail_register"
        ? null
        : {
            id: "registration-1",
            competitionId: "competition-1",
            profileId: "profile-1",
            teamId: null,
            status: "registered",
            statusReason: null,
            registeredAt: "2026-04-22T11:00:00.000Z",
            updatedAt: "2026-04-22T11:00:00.000Z",
            actorIsLeader: false,
            actorCanStart: true,
            actorCanWrite: true,
            teamName: null,
          },
    activeAttempt: null,
    latestAttempt: null,
    problems: [
      {
        competitionProblemId: "cp-1",
        competitionId: "competition-1",
        problemId: "problem-1",
        orderIndex: 1,
        points: 3,
        type: "numeric",
        contentLatex: "2+2",
        explanationLatex: "",
        options: [],
        imagePath: null,
        tags: [],
        difficulty: "easy",
      },
    ],
    eligibleTeams: [],
    attemptsRemaining: 1,
    canRegister: mode === "detail_register",
    canResume: false,
    nowIso: "2026-04-22T11:55:00.000Z",
  };
}

describe("ArenaExperience", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    routerRefreshMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("fails closed into detail/register mode", () => {
    render(<ArenaExperience initialData={buildPageData("detail_register")} />);

    expect(screen.getByText("Entry status")).toBeInTheDocument();
    expect(screen.queryByText("Navigator")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register for competition" })).not.toBeInTheDocument();
    expect(screen.getByText(/Registration controls are intentionally absent here/i)).toBeInTheDocument();
  });

  test("requires all acknowledgements before start", () => {
    render(<ArenaExperience initialData={buildPageData("pre_entry")} />);

    const startButton = screen.getByRole("button", { name: "Start competition" });
    expect(startButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw registration" })).toBeEnabled();

    const checkboxes = screen.getAllByRole("checkbox");
    for (const checkbox of checkboxes) {
      fireEvent.click(checkbox);
    }

    expect(startButton).toBeEnabled();
  });

  test("does not activate anti-cheat observer when tab-switch logging is disabled", () => {
    const data = buildPageData("arena_runtime");
    data.competition.logTabSwitch = false;
    data.activeAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "in_progress",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: null,
      totalTimeSeconds: 0,
      remainingSeconds: 3600,
      effectiveAttemptDeadlineAt: "2026-04-22T13:00:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T13:00:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [],
    };

    render(<ArenaExperience initialData={data} />);

    window.dispatchEvent(new Event("blur"));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.anything(),
    );
    expect(screen.queryByText("Warning: Focus Lost")).not.toBeInTheDocument();
    expect(screen.getByText("Anti-cheat tab-switch logging disabled for this competition.")).toBeInTheDocument();
  });

  test("shows visible anti-cheat status after sustained focus loss is detected", async () => {
    vi.useFakeTimers();
    const data = buildPageData("arena_runtime");
    data.activeAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "in_progress",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: null,
      totalTimeSeconds: 0,
      remainingSeconds: 3600,
      effectiveAttemptDeadlineAt: "2026-04-22T13:00:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T13:00:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [],
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ penaltyApplied: "warning" }), { status: 200 }),
    );

    render(<ArenaExperience initialData={data} />);

    expect(screen.getByText(/Anti-cheat active/i)).toBeInTheDocument();
    expect(screen.getByText(/Browser signal:/i)).toBeInTheDocument();
    expect(screen.getByText(/Browser signal counters: visibilitychange 0, blur 0/i)).toBeInTheDocument();
    window.dispatchEvent(new Event("blur"));

    expect(screen.queryByText(/Anti-cheat event detected: blur/i)).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByText(/Anti-cheat event detected: blur/i)).toBeInTheDocument();
    expect(screen.getByText(/Browser signal counters: visibilitychange 0, blur 1/i)).toBeInTheDocument();
  });

  test("shows warning overlay after sustained focus loss before offense request resolves", async () => {
    vi.useFakeTimers();
    const data = buildPageData("arena_runtime");
    data.activeAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "in_progress",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: null,
      totalTimeSeconds: 0,
      remainingSeconds: 3600,
      effectiveAttemptDeadlineAt: "2026-04-22T13:00:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T13:00:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [],
    };
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<ArenaExperience initialData={data} />);

    window.dispatchEvent(new Event("blur"));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Warning: Focus Lost");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.objectContaining({
        keepalive: true,
      }),
    );
  });

  test("shows a prominent notice when anti-cheat auto-submitted the latest attempt", () => {
    const data = buildPageData("detail_register");
    data.registration = {
      id: "registration-1",
      competitionId: "competition-1",
      profileId: "profile-1",
      teamId: null,
      status: "registered",
      statusReason: null,
      registeredAt: "2026-04-22T11:00:00.000Z",
      updatedAt: "2026-04-22T11:00:00.000Z",
      actorIsLeader: false,
      actorCanStart: true,
      actorCanWrite: true,
      teamName: null,
    };
    data.latestAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "auto_submitted",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: "2026-04-22T12:15:00.000Z",
      totalTimeSeconds: 900,
      remainingSeconds: 0,
      effectiveAttemptDeadlineAt: "2026-04-22T13:00:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T13:00:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [],
    };

    render(<ArenaExperience initialData={data} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Attempt auto-submitted");
    expect(screen.getByText(/repeated focus-loss offenses were logged/i)).toBeInTheDocument();
  });

  test("open competitions can start from pre-entry without a registration id", async () => {
    const openData = buildPageData("pre_entry");
    openData.competition = {
      ...openData.competition,
      type: "open",
      status: "published",
      startTime: null,
      endTime: null,
      attemptsAllowed: 3,
    };
    openData.registration = null;
    openData.attemptsRemaining = 3;

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: buildPageData("arena_runtime") }), { status: 200 }),
    );

    render(<ArenaExperience initialData={openData} />);

    expect(screen.queryByRole("button", { name: "Withdraw registration" })).not.toBeInTheDocument();
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getByText("Open access")).toBeInTheDocument();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      fireEvent.click(checkbox);
    }

    fireEvent.click(screen.getByRole("button", { name: "Start competition" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/mathlete/competition/competition-1/start",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({
      registrationId: null,
      attemptId: null,
    });
  });

  test("pre-entry can withdraw registration before an attempt starts", async () => {
    const withdrawnData = {
      ...buildPageData("detail_register"),
      registration: {
        ...buildPageData("pre_entry").registration!,
        status: "withdrawn" as const,
        statusReason: "participant_withdrew",
      },
    };

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/state")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: withdrawnData }), { status: 200 }),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            tone: "success",
            message: "Registration withdrawn.",
          }),
          { status: 200 },
        ),
      );
    });

    render(<ArenaExperience initialData={buildPageData("pre_entry")} />);

    fireEvent.click(screen.getByRole("button", { name: "Withdraw registration" }));
    await screen.findByText("Withdraw registration?");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/mathlete/competition/withdraw",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({
      registrationId: "registration-1",
      competitionId: "competition-1",
      statusReason: "participant_withdrew",
    });
  });

  test("flushes pending autosave before submit", async () => {
    const runtimeData = buildPageData("arena_runtime");
    runtimeData.activeAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "in_progress",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: null,
      totalTimeSeconds: 0,
      remainingSeconds: 1800,
      effectiveAttemptDeadlineAt: "2026-04-22T12:30:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T12:30:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [
        {
          id: "answer-1",
          attemptId: "attempt-1",
          competitionProblemId: "cp-1",
          answerLatex: "",
          answerTextNormalized: "",
          statusFlag: "blank",
          lastSavedAt: "",
          clientUpdatedAt: "",
        },
      ],
    };
    runtimeData.latestAttempt = runtimeData.activeAttempt;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/answer")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              machineCode: "ok",
              data: { lastSavedAt: "2026-04-22T12:05:00.000Z" },
            }),
            { status: 200 },
          ),
        );
      }

      if (url.endsWith("/submit")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                ...runtimeData,
                mode: "detail_register",
                activeAttempt: null,
                latestAttempt: {
                  ...runtimeData.activeAttempt,
                  status: "submitted",
                  submittedAt: "2026-04-22T12:05:01.000Z",
                  remainingSeconds: 0,
                },
              },
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: runtimeData,
          }),
          { status: 200 },
        ),
      );
    });

    render(<ArenaExperience initialData={runtimeData} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review & Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit attempt" }));

    await waitFor(() => {
      const calledUrls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(calledUrls.findIndex((url) => url.endsWith("/answer"))).toBeGreaterThanOrEqual(0);
      expect(calledUrls.findIndex((url) => url.endsWith("/submit"))).toBeGreaterThanOrEqual(0);
      expect(calledUrls.findIndex((url) => url.endsWith("/answer"))).toBeLessThan(
        calledUrls.findIndex((url) => url.endsWith("/submit")),
      );
    });
  });

  test("marks non-empty answers filled even when previous persisted status was blank", () => {
    const runtimeData = buildPageData("arena_runtime");
    runtimeData.activeAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "in_progress",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: null,
      totalTimeSeconds: 0,
      remainingSeconds: 1800,
      effectiveAttemptDeadlineAt: "2026-04-22T12:30:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T12:30:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [
        {
          id: "answer-1",
          attemptId: "attempt-1",
          competitionProblemId: "cp-1",
          answerLatex: "",
          answerTextNormalized: "",
          statusFlag: "blank",
          lastSavedAt: "",
          clientUpdatedAt: "",
        },
      ],
    };
    runtimeData.latestAttempt = runtimeData.activeAttempt;

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          machineCode: "ok",
          data: { lastSavedAt: "2026-04-22T12:05:00.000Z" },
        }),
        { status: 200 },
      ),
    );

    render(<ArenaExperience initialData={runtimeData} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), {
      target: { value: "42" },
    });

    expect(screen.getAllByText("Filled").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Q1 Filled" })).toBeInTheDocument();
  });

  test("pre-entry start transitions into runtime when route returns active attempt data", async () => {
    const preEntryData = buildPageData("pre_entry");
    const runtimeData = buildPageData("arena_runtime");
    runtimeData.competition.type = "open";
    runtimeData.competition.status = "live";
    runtimeData.activeAttempt = {
      id: "attempt-1",
      competitionId: "competition-1",
      registrationId: "registration-1",
      attemptNo: 1,
      status: "in_progress",
      startedAt: "2026-04-22T12:00:00.000Z",
      submittedAt: null,
      totalTimeSeconds: 0,
      remainingSeconds: 1800,
      effectiveAttemptDeadlineAt: "2026-04-22T12:30:00.000Z",
      attemptBaseDeadlineAt: "2026-04-22T12:30:00.000Z",
      scheduledCompetitionEndCapAt: "2026-04-22T13:00:00.000Z",
      answers: [
        {
          id: "answer-1",
          attemptId: "attempt-1",
          competitionProblemId: "cp-1",
          answerLatex: "",
          answerTextNormalized: "",
          statusFlag: "blank",
          lastSavedAt: "2026-04-22T12:00:00.000Z",
          clientUpdatedAt: "2026-04-22T12:00:00.000Z",
        },
      ],
    };
    runtimeData.latestAttempt = runtimeData.activeAttempt;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/start")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: runtimeData,
              machineCode: "ok",
            }),
            { status: 200 },
          ),
        );
      }

      if (url.endsWith("/state")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: runtimeData,
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: runtimeData,
          }),
          { status: 200 },
        ),
      );
    });

    render(<ArenaExperience initialData={preEntryData} />);

    for (const checkbox of screen.getAllByRole("checkbox")) {
      fireEvent.click(checkbox);
    }

    fireEvent.click(screen.getByRole("button", { name: "Start competition" }));

    await waitFor(() => {
      expect(screen.getByText("Question Grid")).toBeInTheDocument();
      expect(screen.getByText(/Attempt:/)).toBeInTheDocument();
    });
  });
});
