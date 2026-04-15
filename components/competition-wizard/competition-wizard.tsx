"use client";

import { useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Info,
  CopyPlus,
  GripVertical,
  Search,
  Sparkles,
  Archive,
  Send,
  Trash2,
  Play,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressLink } from "@/components/ui/progress-link";
import { OrganizerScoringRuleControls } from "@/components/organizer/scoring-rule-controls";
import { ScoringSummaryCard } from "@/components/scoring/scoring-summary-card";
import { buildCompetitionScoringSnapshot, validateCompetitionDraftInput, validateCompetitionPublishReadiness } from "@/lib/competition/validation";
import type { CompetitionDraftFormState, CompetitionProblemOption, CompetitionRecord, CompetitionStatus, CompetitionWizardStep } from "@/lib/competition/types";
import type { ScoringRuleConfig } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

type WizardMode = "create" | "edit";

const WIZARD_STEPS: Array<{ id: CompetitionWizardStep; title: string; description: string }> = [
  { id: "overview", title: "Overview", description: "Name, rules, and instructions." },
  { id: "schedule", title: "Schedule", description: "Type, timing, and capacity." },
  { id: "format", title: "Format", description: "Individual or team setup." },
  { id: "problems", title: "Problems", description: "Pick and order selected problems." },
  { id: "scoring", title: "Scoring", description: "Attempts, penalties, and anti-cheat." },
  { id: "review", title: "Review", description: "Check state before create or publish." },
];

function createFormErrorLookup(errors: { field: string; reason: string }[]) {
  return new Map(errors.map((error) => [error.field, error.reason]));
}

const FIELD_TO_ELEMENT_ID: Record<string, string> = {
  name: "competition-name",
  description: "competition-description",
  instructions: "competition-instructions",
  registrationStart: "registration-start",
  registrationEnd: "registration-end",
  startTime: "competition-start",
  endTime: "competition-end",
  format: "competition-format",
  attemptsAllowed: "attempts-allowed",
  maxParticipants: "max-participants",
  participantsPerTeam: "participants-per-team",
  maxTeams: "max-teams",
  answerKeyVisibility: "answer-key-visibility",
};

function focusFirstValidationField(errors: { field: string; reason: string }[]) {
  if (typeof document === "undefined") {
    return;
  }

  const firstError = errors[0];
  if (!firstError) {
    return;
  }

  const elementId = FIELD_TO_ELEMENT_ID[firstError.field];
  if (!elementId) {
    return;
  }

  const field = document.getElementById(elementId);
  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function buildValidationStatusMessage(baseMessage: string, errors: { field: string; reason: string }[]) {
  const firstReason = errors[0]?.reason;
  return firstReason ? `${baseMessage} ${firstReason}` : baseMessage;
}

function competitionStatusLabel(status: CompetitionStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "ended":
      return "Ended";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

function parseCompetitionStatus(value: unknown): CompetitionStatus | null {
  if (
    value === "draft" ||
    value === "published" ||
    value === "live" ||
    value === "paused" ||
    value === "ended" ||
    value === "archived"
  ) {
    return value;
  }

  return null;
}

function resolveCompetitionStatusFromResponse(body: Record<string, unknown> | null): CompetitionStatus | null {
  if (!body) {
    return null;
  }

  const competitionRecord =
    typeof body.competition === "object" && body.competition !== null && !Array.isArray(body.competition)
      ? (body.competition as Record<string, unknown>)
      : null;
  const lifecycleRecord =
    typeof body.lifecycle === "object" && body.lifecycle !== null && !Array.isArray(body.lifecycle)
      ? (body.lifecycle as Record<string, unknown>)
      : null;

  return (
    parseCompetitionStatus(lifecycleRecord?.status) ??
    parseCompetitionStatus(lifecycleRecord?.currentStatus) ??
    parseCompetitionStatus(body.currentStatus) ??
    parseCompetitionStatus(body.status) ??
    parseCompetitionStatus(competitionRecord?.status)
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function escapeSearch(value: string) {
  return value.trim().toLowerCase();
}

function buildScoringConfig(state: CompetitionDraftFormState): ScoringRuleConfig {
  return {
    scoringMode: state.scoringMode,
    penaltyMode: state.penaltyMode,
    deductionValue: state.deductionValue,
    tieBreaker: state.tieBreaker,
    multiAttemptGradingMode: state.multiAttemptGradingMode,
    shuffleQuestions: state.shuffleQuestions,
    shuffleOptions: state.shuffleOptions,
    logTabSwitch: state.logTabSwitch,
    offensePenalties: state.offensePenalties,
    customPointsByProblemId: state.customPointsByProblemId,
  };
}

function buildSelectedProblemSet(selectedProblemIds: string[]) {
  return new Set(selectedProblemIds);
}

function buildProblemBankOptions(problems: CompetitionProblemOption[]) {
  return Array.from(new Map(problems.map((problem) => [problem.bankId, problem.bankName])));
}

function getSuggestedProblemPoints(problem: CompetitionProblemOption) {
  if (problem.difficulty === "easy") {
    return 1;
  }

  if (problem.difficulty === "difficult") {
    return 3;
  }

  return 2;
}

function seedCustomPoints(
  currentPoints: Record<string, number>,
  problemsToSeed: CompetitionProblemOption[],
) {
  const nextPoints = { ...currentPoints };

  problemsToSeed.forEach((problem) => {
    if (typeof nextPoints[problem.id] !== "number") {
      nextPoints[problem.id] = getSuggestedProblemPoints(problem);
    }
  });

  return nextPoints;
}

function pruneCustomPoints(
  currentPoints: Record<string, number>,
  selectedProblemIds: string[],
) {
  const selectedIds = new Set(selectedProblemIds);

  return Object.fromEntries(
    Object.entries(currentPoints).filter(([problemId]) => selectedIds.has(problemId)),
  );
}

function buildProblemLabel(problem: CompetitionProblemOption) {
  const rawLabel = problem.contentLatex || `${problem.bankName} ${problem.type} problem`;
  const compactLabel = rawLabel.replace(/\s+/g, " ").trim();

  if (compactLabel.length <= 80) {
    return compactLabel;
  }

  return `${compactLabel.slice(0, 77).trimEnd()}...`;
}

function getResponseErrorMessage(
  body: Record<string, unknown> | null,
  fallbackMessage: string,
) {
  if (!body) {
    return fallbackMessage;
  }

  if (Array.isArray(body.errors)) {
    const firstError = body.errors.find(
      (entry): entry is { reason?: string } =>
        typeof entry === "object" && entry !== null && "reason" in entry,
    );
    if (typeof firstError?.reason === "string" && firstError.reason.trim()) {
      return firstError.reason;
    }
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  return fallbackMessage;
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface CompetitionWizardProps {
  mode: WizardMode;
  competitionId?: string;
  initialState: CompetitionDraftFormState;
  initialCompetition?: CompetitionRecord | null;
  availableProblems: CompetitionProblemOption[];
}

export function CompetitionWizard({
  mode,
  competitionId,
  initialState,
  initialCompetition,
  availableProblems,
}: CompetitionWizardProps) {
  const router = useRouter();
  const [draftState, setDraftState] = useState<CompetitionDraftFormState>(initialState);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<CompetitionWizardStep>("overview");
  const [draftRevision, setDraftRevision] = useState<number>(initialCompetition?.draftRevision ?? 1);
  const [competitionStatus, setCompetitionStatus] = useState<CompetitionStatus>(initialCompetition?.status ?? "draft");
  const [problemSearch, setProblemSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [savingAction, setSavingAction] = useState<
    "save" | "create" | "publish" | "start" | "end" | "archive" | "delete" | null
  >(null);

  const deferredSearch = useDeferredValue(problemSearch.trim());
  const draftValidation = validateCompetitionDraftInput(draftState);
  const publishValidation = validateCompetitionPublishReadiness(draftState);
  const scoringConfig = buildScoringConfig(draftState);
  const selectedProblemSet = buildSelectedProblemSet(draftState.selectedProblemIds);
  const bankOptions = buildProblemBankOptions(availableProblems);

  const selectedProblems = draftState.selectedProblemIds
    .map((problemId) => availableProblems.find((problem) => problem.id === problemId))
    .filter((problem): problem is CompetitionProblemOption => Boolean(problem));

  const filteredProblems = availableProblems.filter((problem) => {
    const bankMatches = bankFilter === "all" || problem.bankId === bankFilter;
    if (!bankMatches) {
      return false;
    }

    if (!deferredSearch) {
      return true;
    }

    const haystack = [
      problem.bankName,
      problem.type,
      problem.difficulty,
      problem.contentLatex,
      problem.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(escapeSearch(deferredSearch));
  });

  const formErrorLookup = createFormErrorLookup(draftValidation.errors);
  const publishErrorLookup = createFormErrorLookup(publishValidation.errors);
  const selectedProblemCount = draftState.selectedProblemIds.length;
  const scheduleErrors = draftValidation.errors.filter((error) =>
    ["type", "registrationStart", "registrationEnd", "startTime", "endTime"].includes(error.field),
  );
  const visibleProblemIds = filteredProblems.map((problem) => problem.id);
  const activeBankName = bankOptions.find(([bankId]) => bankId === bankFilter)?.[1] ?? null;
  const isEditable = competitionStatus === "draft";
  const canPublish = competitionStatus === "draft" && publishValidation.ok && publishValidation.value !== null;
  const canStart = competitionStatus === "published" && draftState.type === "open";
  const canEnd = (competitionStatus === "live" || competitionStatus === "paused") && draftState.type === "open";
  const canArchive = competitionStatus === "ended" || (competitionStatus === "paused" && draftState.type === "open");
  const canDelete = competitionStatus === "draft";

  function syncStateFromResponse(body: Record<string, unknown> | null) {
    if (!body) {
      return;
    }

    const lifecycleRecord =
      typeof body.lifecycle === "object" && body.lifecycle !== null && !Array.isArray(body.lifecycle)
        ? (body.lifecycle as Record<string, unknown>)
        : null;

    const nextStatus = resolveCompetitionStatusFromResponse(body);

    if (nextStatus) {
      setCompetitionStatus(nextStatus);
    }

    const nextRevision =
      typeof body.currentDraftRevision === "number"
        ? body.currentDraftRevision
        : typeof lifecycleRecord?.draftRevision === "number"
          ? lifecycleRecord.draftRevision
          : null;

    if (typeof nextRevision === "number" && Number.isFinite(nextRevision)) {
      setDraftRevision(Math.trunc(nextRevision));
    }
  }

  function updateDraft<K extends keyof CompetitionDraftFormState>(field: K, value: CompetitionDraftFormState[K]) {
    setDraftState((current) => ({ ...current, [field]: value }));
    setStatus("idle");
    setStatusMessage(null);
  }

  function replaceDraft(nextState: CompetitionDraftFormState) {
    setDraftState(nextState);
    setStatus("idle");
    setStatusMessage(null);
  }

  function setCompetitionType(nextType: "open" | "scheduled") {
    setDraftState((current) => {
      if (nextType === "open") {
        return {
          ...current,
          type: "open",
          format: "individual",
          registrationStart: "",
          registrationEnd: "",
          startTime: "",
          endTime: "",
          attemptsAllowed: Math.max(1, Math.min(3, current.attemptsAllowed)),
          maxParticipants: current.maxParticipants ?? 3,
          participantsPerTeam: null,
          maxTeams: null,
        };
      }

      return {
        ...current,
        type: "scheduled",
        attemptsAllowed: 1,
      };
    });
    setStatus("idle");
    setStatusMessage(null);
  }

  function toggleProblem(problemId: string) {
    if (!isEditable && mode === "edit") {
      return;
    }

    setDraftState((current) => {
      const selected = new Set(current.selectedProblemIds);
      const problem = availableProblems.find((entry) => entry.id === problemId);

      if (selected.has(problemId)) {
        selected.delete(problemId);
      } else {
        selected.add(problemId);
      }

      const nextSelectedProblemIds = Array.from(selected);
      const nextCustomPointsByProblemId = selected.has(problemId) && current.scoringMode === "custom" && problem
        ? seedCustomPoints(current.customPointsByProblemId, [problem])
        : pruneCustomPoints(current.customPointsByProblemId, nextSelectedProblemIds);

      return {
        ...current,
        selectedProblemIds: nextSelectedProblemIds,
        customPointsByProblemId: nextCustomPointsByProblemId,
      };
    });
  }

  function moveSelectedProblem(problemId: string, direction: -1 | 1) {
    if (!isEditable && mode === "edit") {
      return;
    }

    setDraftState((current) => {
      const nextIds = [...current.selectedProblemIds];
      const fromIndex = nextIds.indexOf(problemId);
      const toIndex = fromIndex + direction;

      if (fromIndex < 0 || toIndex < 0 || toIndex >= nextIds.length) {
        return current;
      }

      const [moved] = nextIds.splice(fromIndex, 1);
      nextIds.splice(toIndex, 0, moved);
      return { ...current, selectedProblemIds: nextIds };
    });
  }

  function addProblemIds(problemIds: string[]) {
    if (!isEditable && mode === "edit") {
      return;
    }

    setDraftState((current) => {
      const selected = new Set(current.selectedProblemIds);
      problemIds.forEach((problemId) => selected.add(problemId));

      const nextSelectedProblemIds = Array.from(selected);
      const problemsToSeed = availableProblems.filter((problem) => problemIds.includes(problem.id));

      return {
        ...current,
        selectedProblemIds: nextSelectedProblemIds,
        customPointsByProblemId:
          current.scoringMode === "custom"
            ? seedCustomPoints(current.customPointsByProblemId, problemsToSeed)
            : current.customPointsByProblemId,
      };
    });
  }

  function removeProblemIds(problemIds: string[]) {
    if (!isEditable && mode === "edit") {
      return;
    }

    setDraftState((current) => {
      const blockedIds = new Set(problemIds);
      const nextSelectedProblemIds = current.selectedProblemIds.filter((problemId) => !blockedIds.has(problemId));

      return {
        ...current,
        selectedProblemIds: nextSelectedProblemIds,
        customPointsByProblemId: pruneCustomPoints(current.customPointsByProblemId, nextSelectedProblemIds),
      };
    });
  }

  function updateCustomPoint(problemId: string, nextPoints: string) {
    const parsed = Number.parseInt(nextPoints, 10);

    setDraftState((current) => ({
      ...current,
      customPointsByProblemId: {
        ...current.customPointsByProblemId,
        [problemId]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      },
    }));
    setStatus("idle");
    setStatusMessage(null);
  }

  async function submitCreateDraft() {
    if (draftValidation.ok && draftValidation.value) {
      setSavingAction("create");
      setStatus("saving");
      setStatusMessage("Creating draft...");

      try {
        const response = await fetch("/api/organizer/competitions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(draftValidation.value),
        });

        const body = await readJsonResponse(response);
        if (!response.ok || !body) {
          throw new Error(getResponseErrorMessage(body, "Competition create failed."));
        }

        const competition = body.competition as CompetitionRecord | undefined;
        if (!competition) {
          throw new Error("Competition create failed.");
        }

        setStatus("saved");
        router.push(`/organizer/competition/${competition.id}`);
      } catch (error) {
        setStatus("error");
        setStatusMessage(error instanceof Error ? error.message : "Competition create failed.");
      } finally {
        setSavingAction(null);
      }
      return;
    }

    setStatus("error");
    setStatusMessage(buildValidationStatusMessage("Fix validation issues before creating draft.", draftValidation.errors));
    focusFirstValidationField(draftValidation.errors);
  }

  async function saveDraft() {
    if (mode !== "edit" || !competitionId) {
      return;
    }

    if (!draftValidation.ok || !draftValidation.value) {
      setStatus("error");
      setStatusMessage(buildValidationStatusMessage("Fix validation issues before saving draft.", draftValidation.errors));
      focusFirstValidationField(draftValidation.errors);
      return;
    }

    setSavingAction("save");
    setStatus("saving");
    setStatusMessage("Saving draft...");

    try {
      const response = await fetch(`/api/organizer/competitions/${competitionId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...draftValidation.value,
          expectedDraftRevision: draftRevision,
        }),
      });

      const body = await readJsonResponse(response);
      syncStateFromResponse(body);

      if (!response.ok || !body) {
        throw new Error(getResponseErrorMessage(body, "Competition save failed."));
      }

      setStatus("saved");
      setStatusMessage("Draft saved.");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Competition save failed.");
    } finally {
      setSavingAction(null);
    }
  }

  const summaryLines = [
    ["Status", competitionStatusLabel(competitionStatus)],
    ["Competition type", draftState.type],
    ["Format", draftState.format],
    ["Selected problems", String(selectedProblemCount)],
    ["Attempts", String(draftState.attemptsAllowed)],
    ["Answer key visibility", draftState.answerKeyVisibility],
  ] as const;

  return (
    <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
      <div className="min-w-0 space-y-6">
        <Card className="surface-card border-border/60">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="eyebrow">Competition Wizard</div>
                <CardTitle className="text-4xl">
                  {mode === "create" ? "Create competition draft" : draftState.name || "Edit competition draft"}
                </CardTitle>
                <CardDescription className="max-w-2xl text-base leading-7">
                  Build draft, select problems, tune scoring, and lock publish-safe snapshots without mutating live records.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={competitionStatus === "draft" ? "secondary" : "outline"}>
                  {competitionStatusLabel(competitionStatus)}
                </Badge>
                <Badge variant="outline">Revision {draftRevision}</Badge>
                {draftState.type === "scheduled" ? (
                  <Badge variant="outline">Scheduled</Badge>
                ) : (
                  <Badge variant="outline">Open</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {WIZARD_STEPS.map((step) => (
                <Button
                  key={step.id}
                  type="button"
                  variant={activeStep === step.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveStep(step.id)}
                >
                  {step.title}
                </Button>
              ))}
            </div>
          </CardHeader>
        </Card>

        {mode === "edit" && !isEditable ? (
          <Card className="border-amber-300/60 bg-amber-50/80 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
            <CardContent className="flex gap-3 p-4 text-sm text-amber-950 dark:text-amber-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">This competition is read-only now.</p>
                <p>
                  Drafts can still be edited. Published, live, ended, and archived competitions keep frozen problem
                  and scoring snapshots.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section id="overview" className="scroll-mt-24 space-y-4">
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Overview</CardTitle>
              <CardDescription>Competition identity and rules instructions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="competition-name">Competition name</Label>
                  <Input
                    id="competition-name"
                    value={draftState.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    aria-invalid={Boolean(formErrorLookup.get("name"))}
                    disabled={!isEditable && mode === "edit"}
                  />
                  {formErrorLookup.get("name") ? (
                    <p className="text-xs text-destructive">{formErrorLookup.get("name")}</p>
                  ) : null}
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="competition-description">Description</Label>
                  <textarea
                    id="competition-description"
                    value={draftState.description}
                    onChange={(event) => updateDraft("description", event.target.value)}
                    className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-invalid={Boolean(formErrorLookup.get("description"))}
                    disabled={!isEditable && mode === "edit"}
                  />
                  {formErrorLookup.get("description") ? (
                    <p className="text-xs text-destructive">{formErrorLookup.get("description")}</p>
                  ) : null}
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="competition-instructions">Rules and instructions</Label>
                  <textarea
                    id="competition-instructions"
                    value={draftState.instructions}
                    onChange={(event) => updateDraft("instructions", event.target.value)}
                    className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-invalid={Boolean(formErrorLookup.get("instructions"))}
                    disabled={!isEditable && mode === "edit"}
                  />
                  {formErrorLookup.get("instructions") ? (
                    <p className="text-xs text-destructive">{formErrorLookup.get("instructions")}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="schedule" className="scroll-mt-24 space-y-4">
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Schedule</CardTitle>
              <CardDescription>Choose competition type, timing, and registration windows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="competition-type">Competition type</Label>
                  <select
                    id="competition-type"
                    value={draftState.type}
                    onChange={(event) => setCompetitionType(event.target.value === "open" ? "open" : "scheduled")}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={!isEditable && mode === "edit"}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="open">Open</option>
                  </select>
                  {formErrorLookup.get("type") ? (
                    <p className="text-xs text-destructive">{formErrorLookup.get("type")}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="competition-duration">Duration minutes</Label>
                  <Input
                    id="competition-duration"
                    type="number"
                    min={1}
                    value={draftState.durationMinutes}
                    onChange={(event) => updateDraft("durationMinutes", Number.parseInt(event.target.value, 10) || 1)}
                    disabled={!isEditable && mode === "edit"}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="registration-start">Registration start</Label>
                  <Input
                    id="registration-start"
                    type="datetime-local"
                    value={draftState.registrationStart}
                    onChange={(event) => updateDraft("registrationStart", event.target.value)}
                    disabled={draftState.type !== "scheduled" || (!isEditable && mode === "edit")}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="registration-end">Registration end</Label>
                  <Input
                    id="registration-end"
                    type="datetime-local"
                    value={draftState.registrationEnd}
                    onChange={(event) => updateDraft("registrationEnd", event.target.value)}
                    disabled={draftState.type !== "scheduled" || (!isEditable && mode === "edit")}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="competition-start">Competition start</Label>
                  <Input
                    id="competition-start"
                    type="datetime-local"
                    value={draftState.startTime}
                    onChange={(event) => updateDraft("startTime", event.target.value)}
                    disabled={draftState.type !== "scheduled" || (!isEditable && mode === "edit")}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="competition-end">Competition end</Label>
                  <Input
                    id="competition-end"
                    type="datetime-local"
                    value={draftState.endTime}
                    onChange={(event) => updateDraft("endTime", event.target.value)}
                    disabled={draftState.type !== "scheduled" || (!isEditable && mode === "edit")}
                  />
                </div>
              </div>

              {scheduleErrors.length > 0 ? (
                <Card className="border-amber-300/60 bg-amber-50/80 shadow-none dark:border-amber-900/60 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                      Schedule needs attention before save or publish.
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200">
                      {scheduleErrors.map((error) => (
                        <li key={`${error.field}:${error.reason}`}>{error.reason}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                {draftState.type === "scheduled"
                  ? "Scheduled competitions must provide registration and start times. Registration must close before competition start."
                  : "Open competitions clear registration windows and scheduled start times. They use manual lifecycle controls instead."}
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="format" className="scroll-mt-24 space-y-4">
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Format</CardTitle>
              <CardDescription>Participant capacity, attempts, and answer-key visibility.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="competition-format">Format</Label>
                  <select
                    id="competition-format"
                    value={draftState.format}
                    onChange={(event) =>
                      setDraftState((current) => {
                        const nextFormat = event.target.value === "team" ? "team" : "individual";

                        return nextFormat === "team"
                          ? {
                              ...current,
                              format: nextFormat,
                              maxParticipants: null,
                              participantsPerTeam: current.participantsPerTeam ?? 2,
                              maxTeams: current.maxTeams ?? 3,
                            }
                          : {
                              ...current,
                              format: nextFormat,
                              maxParticipants: current.maxParticipants ?? 3,
                              participantsPerTeam: null,
                              maxTeams: null,
                            };
                      })
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={!isEditable && mode === "edit"}
                  >
                    <option value="individual">Individual</option>
                    <option value="team">Team</option>
                  </select>
                  {formErrorLookup.get("format") ? (
                    <p className="text-xs text-destructive">{formErrorLookup.get("format")}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="attempts-allowed">Attempts allowed</Label>
                  <Input
                    id="attempts-allowed"
                    type="number"
                    min={1}
                    max={3}
                    value={draftState.attemptsAllowed}
                    onChange={(event) => updateDraft("attemptsAllowed", Number.parseInt(event.target.value, 10) || 1)}
                    disabled={!isEditable && mode === "edit"}
                  />
                  {formErrorLookup.get("attemptsAllowed") ? (
                    <p className="text-xs text-destructive">{formErrorLookup.get("attemptsAllowed")}</p>
                  ) : null}
                </div>

                {draftState.format === "individual" ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="max-participants">Max participants</Label>
                    <Input
                      id="max-participants"
                      type="number"
                      min={3}
                      max={100}
                      value={draftState.maxParticipants ?? 3}
                      onChange={(event) =>
                        updateDraft("maxParticipants", Number.parseInt(event.target.value, 10) || 3)
                      }
                      disabled={!isEditable && mode === "edit"}
                    />
                    {formErrorLookup.get("maxParticipants") ? (
                      <p className="text-xs text-destructive">{formErrorLookup.get("maxParticipants")}</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="participants-per-team">Participants per team</Label>
                      <Input
                        id="participants-per-team"
                        type="number"
                        min={2}
                        max={5}
                        value={draftState.participantsPerTeam ?? 2}
                        onChange={(event) =>
                          updateDraft("participantsPerTeam", Number.parseInt(event.target.value, 10) || 2)
                        }
                        disabled={!isEditable && mode === "edit"}
                      />
                      {formErrorLookup.get("participantsPerTeam") ? (
                        <p className="text-xs text-destructive">{formErrorLookup.get("participantsPerTeam")}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="max-teams">Max teams</Label>
                      <Input
                        id="max-teams"
                        type="number"
                        min={3}
                        max={50}
                        value={draftState.maxTeams ?? 3}
                        onChange={(event) =>
                          updateDraft("maxTeams", Number.parseInt(event.target.value, 10) || 3)
                        }
                        disabled={!isEditable && mode === "edit"}
                      />
                      {formErrorLookup.get("maxTeams") ? (
                        <p className="text-xs text-destructive">{formErrorLookup.get("maxTeams")}</p>
                      ) : null}
                    </div>
                  </>
                )}

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="answer-key-visibility">Answer-key visibility</Label>
                  <select
                    id="answer-key-visibility"
                    value={draftState.answerKeyVisibility}
                    onChange={(event) =>
                      updateDraft(
                        "answerKeyVisibility",
                        event.target.value === "hidden" ? "hidden" : "after_end",
                      )
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={!isEditable && mode === "edit"}
                  >
                    <option value="after_end">After end</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="problems" className="scroll-mt-24 space-y-4">
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Problems</CardTitle>
              <CardDescription>Select, search, and order problems before publish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={problemSearch}
                    onChange={(event) => setProblemSearch(event.target.value)}
                    placeholder="Search problems, banks, tags, or difficulty"
                    className="pl-9"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="problem-bank-filter">Bank filter</Label>
                  <select
                    id="problem-bank-filter"
                    value={bankFilter}
                    onChange={(event) => setBankFilter(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All banks</option>
                    {bankOptions.map(([bankId, bankName]) => (
                      <option key={bankId} value={bankId}>
                        {bankName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addProblemIds(visibleProblemIds)}
                  disabled={!isEditable || visibleProblemIds.length === 0}
                >
                  Select visible
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeProblemIds(visibleProblemIds)}
                  disabled={!isEditable || visibleProblemIds.length === 0}
                >
                  Remove visible
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addProblemIds(
                      availableProblems
                        .filter((problem) => problem.bankId === bankFilter)
                        .map((problem) => problem.id),
                    )
                  }
                  disabled={!isEditable || bankFilter === "all"}
                >
                  {activeBankName ? `Select ${activeBankName}` : "Select bank"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    removeProblemIds(
                      availableProblems
                        .filter((problem) => problem.bankId === bankFilter)
                        .map((problem) => problem.id),
                    )
                  }
                  disabled={!isEditable || bankFilter === "all"}
                >
                  Remove bank
                </Button>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Selected problems</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProblemCount} selected. Publish requires 10 to 100.
                      </p>
                    </div>
                    <Badge variant={selectedProblemCount >= 10 ? "default" : "secondary"}>
                      {selectedProblemCount}
                    </Badge>
                  </div>

                  {selectedProblems.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                      Pick problems from the list to build competition snapshots.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedProblems.map((problem, index) => (
                        <div key={problem.id} className="rounded-xl border border-border/60 bg-background p-3">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold text-foreground">{problem.bankName}</p>
                              <p className="line-clamp-2 break-all text-sm text-muted-foreground">
                                {problem.contentLatex || "Untitled problem"}
                              </p>
                              <p className="break-words text-xs text-muted-foreground">
                                {problem.type} · {problem.difficulty} · {problem.tags.join(" | ") || "No tags"}
                              </p>

                              {draftState.scoringMode === "custom" ? (
                                <div className="grid max-w-52 gap-2 pt-2">
                                  <Label htmlFor={`custom-points-${problem.id}`}>
                                    Custom points for {buildProblemLabel(problem)}
                                  </Label>
                                  <Input
                                    id={`custom-points-${problem.id}`}
                                    type="number"
                                    min={0}
                                    value={
                                      draftState.customPointsByProblemId[problem.id] ??
                                      getSuggestedProblemPoints(problem)
                                    }
                                    onChange={(event) => updateCustomPoint(problem.id, event.target.value)}
                                    disabled={!isEditable && mode === "edit"}
                                  />
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => moveSelectedProblem(problem.id, -1)}
                                disabled={index === 0}
                                aria-label="Move selected problem up"
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => moveSelectedProblem(problem.id, 1)}
                                disabled={index === selectedProblems.length - 1}
                                aria-label="Move selected problem down"
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleProblem(problem.id)}
                                disabled={!isEditable && mode === "edit"}
                                aria-label="Remove selected problem"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Available problems</p>
                      <p className="text-xs text-muted-foreground">
                        {filteredProblems.length} visible after search and bank filter.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraftState((current) => ({
                          ...current,
                          selectedProblemIds: [],
                          customPointsByProblemId: {},
                        }))
                      }
                      disabled={!isEditable && mode === "edit"}
                    >
                      <CopyPlus className="size-4" />
                      Clear
                    </Button>
                  </div>

                  <div className="max-h-[32rem] space-y-3 overflow-x-hidden overflow-y-auto pr-1">
                    {filteredProblems.map((problem) => {
                      const isSelected = selectedProblemSet.has(problem.id);
                      return (
                        <button
                          key={problem.id}
                          type="button"
                          onClick={() => toggleProblem(problem.id)}
                          disabled={!isEditable && mode === "edit"}
                          className={cn(
                            "w-full rounded-xl border p-4 text-left transition-colors",
                            isSelected
                              ? "border-primary/70 bg-primary/5"
                              : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/20",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={isSelected ? "default" : "outline"}>{problem.bankName}</Badge>
                                <Badge variant="outline">{problem.difficulty}</Badge>
                                <Badge variant="outline">{problem.type}</Badge>
                              </div>
                              <p className="line-clamp-2 break-all text-sm text-foreground">
                                {problem.contentLatex || "Untitled problem"}
                              </p>
                              <p className="break-words text-xs text-muted-foreground">
                                {problem.tags.join(" | ") || "No tags"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                              <GripVertical className="size-4" />
                              {isSelected ? "Selected" : "Add"}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {filteredProblems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                        No problems match current filters.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {publishErrorLookup.get("selectedProblemIds") ? (
                <p className="text-xs text-destructive">{publishErrorLookup.get("selectedProblemIds")}</p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section id="scoring" className="scroll-mt-24 space-y-4">
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Scoring</CardTitle>
              <CardDescription>Set scoring contract, penalties, and anti-cheat behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <OrganizerScoringRuleControls
                value={scoringConfig}
                competitionType={draftState.type}
                onChange={(nextValue) =>
                  replaceDraft({
                    ...draftState,
                    ...nextValue,
                    customPointsByProblemId:
                      nextValue.scoringMode === "custom"
                        ? seedCustomPoints(nextValue.customPointsByProblemId, selectedProblems)
                        : draftState.customPointsByProblemId,
                  })
                }
                validationErrors={draftValidation.ok ? [] : draftValidation.errors.filter((error) =>
                  [
                    "scoringMode",
                    "penaltyMode",
                    "deductionValue",
                    "tieBreaker",
                    "multiAttemptGradingMode",
                    "customPointsByProblemId",
                    "offensePenalties",
                  ].includes(error.field),
                )}
                disabled={!isEditable && mode === "edit"}
              />

              <ScoringSummaryCard
                config={scoringConfig}
                context="wizard"
                options={{
                  competitionType: draftState.type,
                  selectedProblemCount,
                }}
              />
            </CardContent>
          </Card>
        </section>

        <section id="review" className="scroll-mt-24 space-y-4">
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Review</CardTitle>
              <CardDescription>Confirm final draft state before create, save, or publish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryLines.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {draftValidation.ok && draftValidation.value ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100">
                  Draft validation passed. Ready to {mode === "create" ? "create" : "save"}.
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100">
                  Resolve validation issues before saving or publishing.
                </div>
              )}

              {mode === "edit" ? (
                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex w-full flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void saveDraft()}
                      pending={savingAction === "save"}
                      pendingText="Saving..."
                      disabled={!isEditable || draftValidation.ok === false}
                    >
                      <CheckCircle2 className="size-4" />
                      Save draft
                    </Button>

                    <Button
                      type="button"
                      variant="default"
                      onClick={() => setPublishConfirmOpen(true)}
                      disabled={!canPublish}
                    >
                      <Send className="size-4" />
                      Publish
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStartConfirmOpen(true)}
                      disabled={!canStart}
                    >
                      <Play className="size-4" />
                      Start
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEndConfirmOpen(true)}
                      disabled={!canEnd}
                    >
                      <Clock3 className="size-4" />
                      End
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setArchiveConfirmOpen(true)}
                      disabled={!canArchive}
                    >
                      <Archive className="size-4" />
                      Archive
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={!canDelete}
                    >
                      <Trash2 className="size-4" />
                      Delete draft
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Draft revision {draftRevision}. Published and later statuses become read-only.
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => void submitCreateDraft()}
                    pending={savingAction === "create"}
                    pendingText="Creating..."
                  >
                    <Sparkles className="size-4" />
                    Create draft
                  </Button>
                  <ProgressLink href="/organizer/competition" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    Back to competition list
                  </ProgressLink>
                </div>
              )}

              {statusMessage ? (
                <div
                  className={cn(
                    "rounded-xl border p-4 text-sm",
                    status === "error"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : status === "saving"
                        ? "border-border/60 bg-muted/20 text-muted-foreground"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100",
                  )}
                >
                  {statusMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <aside className="space-y-6 2xl:sticky 2xl:top-24 2xl:self-start">
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Snapshot preview</CardTitle>
            <CardDescription>
              Draft data here becomes immutable publish-time snapshot material.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftValidation.ok && draftValidation.value ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">Scoring snapshot ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {buildCompetitionScoringSnapshot(draftValidation.value).ok
                    ? "Immutable scoring snapshot can be produced from current draft state."
                    : "Scoring validation needs attention before publish."}
                </p>
              </div>
            ) : null}

            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Competition type</dt>
                <dd className="font-medium">{draftState.type}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Format</dt>
                <dd className="font-medium">{draftState.format}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Selected problems</dt>
                <dd className="font-medium">{selectedProblemCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Attempt grading</dt>
                <dd className="font-medium">{draftState.multiAttemptGradingMode}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Answer-key visibility</dt>
                <dd className="font-medium">{draftState.answerKeyVisibility}</dd>
              </div>
            </dl>

            <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              {mode === "create"
                ? "Create the draft first, then continue edits and lifecycle actions from the competition detail screen."
                : `Updated ${initialCompetition?.updatedAt ? formatDateTime(initialCompetition.updatedAt) : "just now"}.`}
            </div>
          </CardContent>
        </Card>

        {mode === "edit" ? (
          <Card className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Lifecycle notes</CardTitle>
              <CardDescription>Trusted transitions are guarded by the backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Draft edits are allowed only while status stays draft.</p>
              <p>Publish freezes scoring and problem snapshots.</p>
              <p>Open competitions can start and end through organizer controls.</p>
              <p>Scheduled start and end stay server-owned.</p>
            </CardContent>
          </Card>
        ) : null}
      </aside>

      <ConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Publish competition?"
        description={
          canPublish
            ? "This freezes scoring and problem snapshots. Draft edits will no longer be allowed after publish."
            : "Fix validation issues before publishing."
        }
        confirmLabel="Publish"
        confirmVariant="default"
        pending={savingAction === "publish"}
        pendingLabel="Publishing..."
        onConfirm={async () => {
          if (!competitionId || !canPublish) {
            return;
          }

          if (!draftValidation.ok || !draftValidation.value) {
            setStatus("error");
            setStatusMessage(buildValidationStatusMessage("Fix validation issues before publishing.", draftValidation.errors));
            focusFirstValidationField(draftValidation.errors);
            return;
          }

          setSavingAction("publish");
          try {
            setStatus("saving");
            setStatusMessage("Saving draft before publish...");

            const saveResponse = await fetch(`/api/organizer/competitions/${competitionId}`, {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                ...draftValidation.value,
                expectedDraftRevision: draftRevision,
              }),
            });

            const saveBody = await readJsonResponse(saveResponse);
            syncStateFromResponse(saveBody);

            if (!saveResponse.ok || !saveBody) {
              throw new Error(getResponseErrorMessage(saveBody, "Competition save failed."));
            }

            const nextRevision =
              typeof saveBody.currentDraftRevision === "number" && Number.isFinite(saveBody.currentDraftRevision)
                ? Math.trunc(saveBody.currentDraftRevision)
                : draftRevision;
            setDraftRevision(nextRevision);

            const response = await fetch(`/api/organizer/competitions/${competitionId}/publish`, {
              method: "POST",
              headers: {
                "x-idempotency-key": crypto.randomUUID(),
              },
            });

            const body = await readJsonResponse(response);
            syncStateFromResponse(body);

            if (!response.ok || !body) {
              throw new Error(getResponseErrorMessage(body, "Competition publish failed."));
            }

            setStatus("saved");
            setStatusMessage("Competition published.");
            setPublishConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition publish failed.");
            setPublishConfirmOpen(false);
          } finally {
            setSavingAction(null);
            router.refresh();
          }
        }}
      />

      <ConfirmDialog
        open={startConfirmOpen}
        onOpenChange={setStartConfirmOpen}
        title="Start competition?"
        description="Open competitions move from published to live through this trusted organizer action."
        confirmLabel="Start"
        confirmVariant="default"
        pending={savingAction === "start"}
        pendingLabel="Starting..."
        onConfirm={async () => {
          if (!competitionId || !canStart) {
            return;
          }

          setSavingAction("start");
          try {
            const response = await fetch(`/api/organizer/competitions/${competitionId}/start`, {
              method: "POST",
              headers: {
                "x-idempotency-key": crypto.randomUUID(),
              },
            });

            const body = await readJsonResponse(response);
            syncStateFromResponse(body);

            if (!response.ok || !body) {
              throw new Error(getResponseErrorMessage(body, "Competition start failed."));
            }

            setStatus("saved");
            setStatusMessage("Competition started.");
            setStartConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition start failed.");
            setStartConfirmOpen(false);
          } finally {
            setSavingAction(null);
            router.refresh();
          }
        }}
      />

      <ConfirmDialog
        open={endConfirmOpen}
        onOpenChange={setEndConfirmOpen}
        title="End competition?"
        description="Open competitions end through organizer trusted control and record a lifecycle event."
        confirmLabel="End"
        pending={savingAction === "end"}
        pendingLabel="Ending..."
        onConfirm={async () => {
          if (!competitionId || !canEnd) {
            return;
          }

          setSavingAction("end");
          try {
            const response = await fetch(`/api/organizer/competitions/${competitionId}/end`, {
              method: "POST",
              headers: {
                "x-idempotency-key": crypto.randomUUID(),
              },
            });

            const body = await readJsonResponse(response);
            syncStateFromResponse(body);

            if (!response.ok || !body) {
              throw new Error(getResponseErrorMessage(body, "Competition end failed."));
            }

            setStatus("saved");
            setStatusMessage("Competition ended.");
            setEndConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition end failed.");
            setEndConfirmOpen(false);
          } finally {
            setSavingAction(null);
            router.refresh();
          }
        }}
      />

      <ConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
        title="Archive competition?"
        description="Archiving retires the competition without destroying historical records."
        confirmLabel="Archive"
        pending={savingAction === "archive"}
        pendingLabel="Archiving..."
        onConfirm={async () => {
          if (!competitionId || !canArchive) {
            return;
          }

          setSavingAction("archive");
          try {
            const response = await fetch(`/api/organizer/competitions/${competitionId}/archive`, {
              method: "POST",
              headers: {
                "x-idempotency-key": crypto.randomUUID(),
              },
            });

            const body = await readJsonResponse(response);
            syncStateFromResponse(body);

            if (!response.ok || !body) {
              throw new Error(getResponseErrorMessage(body, "Competition archive failed."));
            }

            setStatus("saved");
            setStatusMessage("Competition archived.");
            setArchiveConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition archive failed.");
            setArchiveConfirmOpen(false);
          } finally {
            setSavingAction(null);
            router.refresh();
          }
        }}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete draft?"
        description="This permanently retires an unsaved draft only. Published history stays protected."
        confirmLabel="Delete"
        pending={savingAction === "delete"}
        pendingLabel="Deleting..."
        onConfirm={async () => {
          if (!competitionId || !canDelete) {
            return;
          }

          setSavingAction("delete");
          try {
            const response = await fetch(`/api/organizer/competitions/${competitionId}`, {
              method: "DELETE",
              headers: {
                "x-idempotency-key": crypto.randomUUID(),
              },
            });

            const body = await readJsonResponse(response);
            syncStateFromResponse(body);

            if (!response.ok || !body) {
              throw new Error(getResponseErrorMessage(body, "Competition delete failed."));
            }

            setStatus("saved");
            setStatusMessage("Draft deleted.");
            router.push("/organizer/competition");
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition delete failed.");
          } finally {
            setSavingAction(null);
          }
        }}
      />
    </div>
  );
}
