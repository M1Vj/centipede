"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  CopyPlus,
  GripVertical,
  Search,
  Sparkles,
  Archive,
  Send,
  Trash2,
  Play,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressLink } from "@/components/ui/progress-link";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { OrganizerScoringRuleControls } from "@/components/organizer/scoring-rule-controls";
import { ScoringSummaryCard } from "@/components/scoring/scoring-summary-card";
import { buildCompetitionScoringSnapshot, validateCompetitionDraftInput, validateCompetitionPublishReadiness } from "@/lib/competition/validation";
import type { CompetitionDraftFormState, CompetitionProblemOption, CompetitionRecord, CompetitionStatus, CompetitionWizardStep } from "@/lib/competition/types";
import { buildScoringSummaryView } from "@/lib/scoring/summary";
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

const STEP_PROGRESS_CONFIG: Record<CompetitionWizardStep, { visualStep: number; totalSteps: number; percentage: number; title: string; description: string }> = {
  overview: { visualStep: 1, totalSteps: 5, percentage: 20, title: "Competition Overview", description: "Define the name, rules, and instructions for your competition." },
  schedule: { visualStep: 2, totalSteps: 5, percentage: 40, title: "Format & Schedule", description: "Configure competition type, timing, and participant format." },
  format: { visualStep: 2, totalSteps: 5, percentage: 40, title: "Format & Schedule", description: "Configure competition type, timing, and participant format." },
  problems: { visualStep: 3, totalSteps: 5, percentage: 60, title: "Competition Problems", description: "Select, search, and order problems before publish." },
  scoring: { visualStep: 4, totalSteps: 5, percentage: 80, title: "Competition Scoring", description: "Define scoring rules, penalties, and anti-cheat policies." },
  review: { visualStep: 5, totalSteps: 5, percentage: 99, title: "Competition Review", description: "Review all settings and publish your competition." },
};

const STEP_ORDER: CompetitionWizardStep[] = ["overview", "schedule", "format", "problems", "scoring", "review"];

function getStepNavigation(currentStep: CompetitionWizardStep) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const prevStep = currentIndex > 0 ? STEP_ORDER[currentIndex - 1] : null;
  const nextStep = currentIndex < STEP_ORDER.length - 1 ? STEP_ORDER[currentIndex + 1] : null;
  const nextLabel = nextStep ? WIZARD_STEPS.find(s => s.id === nextStep)?.title ?? "Next" : null;
  const prevLabel = prevStep ? WIZARD_STEPS.find(s => s.id === prevStep)?.title ?? "Back" : null;
  return { prevStep, nextStep, nextLabel, prevLabel };
}

function createFormErrorLookup(errors: { field: string; reason: string }[]) {
  return new Map(errors.map((error) => [error.field, error.reason]));
}

const FIELD_TO_ELEMENT_ID: Record<string, string> = {
  name: "competition-name",
  description: "competition-description",
  instructions: "competition-instructions",
  registrationTimingMode: "registration-timing-mode",
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

function formatDateTimeLocalInput(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`;
}

function computeScheduledEndLocal(startTime: string, durationMinutes: number) {
  if (!startTime.trim()) {
    return "";
  }

  const startAt = new Date(startTime);
  if (Number.isNaN(startAt.getTime())) {
    return "";
  }

  return formatDateTimeLocalInput(new Date(startAt.getTime() + durationMinutes * 60_000));
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

function extractValidationErrors(body: Record<string, unknown> | null) {
  if (!body || !Array.isArray(body.errors)) {
    return [] as Array<{ field: string; reason: string }>;
  }

  return body.errors
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const field = "field" in entry && typeof entry.field === "string" ? entry.field : "form";
      const reason = "reason" in entry && typeof entry.reason === "string" ? entry.reason.trim() : "";

      if (!reason) {
        return null;
      }

      return { field, reason };
    })
    .filter((entry): entry is { field: string; reason: string } => Boolean(entry));
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
  const [reviewProblemPage, setReviewProblemPage] = useState(1);
  const [draftRevision, setDraftRevision] = useState<number>(initialCompetition?.draftRevision ?? 1);
  const [competitionStatus, setCompetitionStatus] = useState<CompetitionStatus>(initialCompetition?.status ?? "draft");
  const [problemSearch, setProblemSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [expandedBankIds, setExpandedBankIds] = useState<Record<string, boolean>>({});
  const [maxParticipantsInput, setMaxParticipantsInput] = useState<string>(
    initialState.maxParticipants === null ? "" : String(initialState.maxParticipants),
  );
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
  const computedScheduledEndLocal =
    draftState.type === "scheduled"
      ? computeScheduledEndLocal(draftState.startTime, draftState.durationMinutes)
      : "";
  const computedRegistrationEndLocal =
    draftState.type === "scheduled" && draftState.registrationTimingMode === "default"
      ? draftState.startTime
      : draftState.registrationEnd;

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
  const selectedBankCount = new Set(selectedProblems.map((problem) => problem.bankId)).size;
  const selectedProblemProgress = Math.min(100, (selectedProblemCount / 10) * 100);
  const isProblemSelectionReady = selectedProblemCount >= 10 && selectedProblemCount <= 100;
  const totalPossiblePoints = selectedProblems.reduce((sum, problem) => {
    const customPoints =
      draftState.scoringMode === "custom"
        ? draftState.customPointsByProblemId[problem.id] ?? getSuggestedProblemPoints(problem)
        : getSuggestedProblemPoints(problem);

    return sum + customPoints;
  }, 0);
  const scoringSummaryView = buildScoringSummaryView(scoringConfig, "review", {
    competitionType: draftState.type,
    selectedProblemCount,
  });
  const scheduleErrors = draftValidation.errors.filter((error) =>
    ["type", "registrationStart", "registrationEnd", "startTime", "endTime"].includes(error.field),
  );
  const visibleProblemIds = filteredProblems.map((problem) => problem.id);
  const groupedVisibleProblems = bankOptions
    .map(([bankId, bankName]) => ({
      bankId,
      bankName,
      problems: filteredProblems.filter((problem) => problem.bankId === bankId),
    }))
    .filter((group) => group.problems.length > 0);
  const isEditable = competitionStatus === "draft";
  const canPublish = competitionStatus === "draft" && publishValidation.ok && publishValidation.value !== null;
  const canStart = competitionStatus === "published" && draftState.type === "open";
  const canEnd = (competitionStatus === "live" || competitionStatus === "paused") && draftState.type === "open";
  const canArchive = competitionStatus === "ended" || (competitionStatus === "paused" && draftState.type === "open");
  const canDelete = competitionStatus === "draft";

  useEffect(() => {
    if (draftState.type === "scheduled") {
      if (draftState.endTime === computedScheduledEndLocal) {
        return;
      }

      setDraftState((current) => {
        if (current.type !== "scheduled" || current.endTime === computedScheduledEndLocal) {
          return current;
        }

        return {
          ...current,
          endTime: computedScheduledEndLocal,
        };
      });
      return;
    }

    if (!draftState.endTime) {
      return;
    }

    setDraftState((current) => {
      if (current.type === "scheduled" || !current.endTime) {
        return current;
      }

      return {
        ...current,
        endTime: "",
      };
    });
  }, [computedScheduledEndLocal, draftState.endTime, draftState.type]);

  useEffect(() => {
    if (draftState.format !== "individual") {
      return;
    }

    setMaxParticipantsInput(draftState.maxParticipants === null ? "" : String(draftState.maxParticipants));
  }, [draftState.format, draftState.maxParticipants]);



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
          registrationTimingMode: "default",
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
        registrationTimingMode: "default",
        registrationStart: "",
        registrationEnd: "",
        attemptsAllowed: 1,
      };
    });
    setStatus("idle");
    setStatusMessage(null);
  }

  function setRegistrationTimingMode(nextMode: "default" | "manual") {
    setDraftState((current) => {
      if (current.type !== "scheduled") {
        return current;
      }

      if (nextMode === "manual") {
        return {
          ...current,
          registrationTimingMode: "manual",
        };
      }

      return {
        ...current,
        registrationTimingMode: "default",
        registrationStart: "",
        registrationEnd: "",
      };
    });
    setStatus("idle");
    setStatusMessage(null);
  }

  function commitMaxParticipantsInput(rawValue: string) {
    const normalized = rawValue.trim();
    if (!normalized) {
      updateDraft("maxParticipants", null);
      return;
    }

    const parsed = Number.parseInt(normalized, 10);
    updateDraft("maxParticipants", Number.isFinite(parsed) ? parsed : null);
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

  function getDraftStateForSubmit() {
    if (draftState.format !== "individual") {
      return draftState;
    }

    const normalized = maxParticipantsInput.trim();
    const parsed = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
    const nextMaxParticipants =
      !normalized || !Number.isFinite(parsed) ? null : Math.trunc(parsed);

    if (nextMaxParticipants === draftState.maxParticipants) {
      return draftState;
    }

    return {
      ...draftState,
      maxParticipants: nextMaxParticipants,
    };
  }

  async function submitCreateDraft() {
    const draftStateForSubmit = getDraftStateForSubmit();
    if (draftStateForSubmit !== draftState) {
      setDraftState(draftStateForSubmit);
    }

    const submitValidation = validateCompetitionDraftInput(draftStateForSubmit);
    if (submitValidation.ok && submitValidation.value) {
      setSavingAction("create");
      setStatus("saving");
      setStatusMessage("Creating draft...");

      try {
        const response = await fetch("/api/organizer/competitions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(submitValidation.value),
        });

        const body = await readJsonResponse(response);
        if (!response.ok) {
          const responseErrors = extractValidationErrors(body);
          if (responseErrors.length > 0) {
            setStatus("error");
            setStatusMessage(
              buildValidationStatusMessage("Competition draft could not be created.", responseErrors),
            );
            focusFirstValidationField(responseErrors);
            return;
          }

          throw new Error(getResponseErrorMessage(body, "Competition create failed."));
        }

        if (!body) {
          throw new Error("Competition create failed.");
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
    setStatusMessage(buildValidationStatusMessage("Fix validation issues before creating draft.", submitValidation.errors));
    focusFirstValidationField(submitValidation.errors);
  }

  async function saveDraft() {
    if (mode !== "edit" || !competitionId) {
      return;
    }

    const draftStateForSubmit = getDraftStateForSubmit();
    if (draftStateForSubmit !== draftState) {
      setDraftState(draftStateForSubmit);
    }

    const submitValidation = validateCompetitionDraftInput(draftStateForSubmit);
    if (!submitValidation.ok || !submitValidation.value) {
      setStatus("error");
      setStatusMessage(buildValidationStatusMessage("Fix validation issues before saving draft.", submitValidation.errors));
      focusFirstValidationField(submitValidation.errors);
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
          ...submitValidation.value,
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

  const isImmersiveStep =
    activeStep === "problems" || activeStep === "scoring" || activeStep === "review";
  const participationSummary =
    draftState.format === "team"
      ? `Team · ${draftState.participantsPerTeam ?? 0} per team · ${draftState.maxTeams ?? 0} max teams`
      : `Individual · ${draftState.maxParticipants ?? 0} max participants`;
  const registrationSummary =
    draftState.type === "scheduled"
      ? draftState.registrationTimingMode === "manual"
        ? `${formatDateTime(draftState.registrationStart || null)} to ${formatDateTime(
            computedRegistrationEndLocal || null,
          )}`
        : "Default registration window until competition start"
      : "Open registration with organizer-controlled lifecycle";
  const competitionWindowSummary =
    draftState.type === "scheduled"
      ? `${formatDateTime(draftState.startTime || null)} to ${formatDateTime(
          computedScheduledEndLocal || null,
        )}`
      : "Open competition starts and ends through organizer controls";
  const reviewProblemPageSize = 4;
  const reviewProblemTotalPages = Math.max(1, Math.ceil(selectedProblems.length / reviewProblemPageSize));
  const normalizedReviewProblemPage = Math.min(reviewProblemPage, reviewProblemTotalPages);
  const reviewPreviewProblems = selectedProblems.slice(
    (normalizedReviewProblemPage - 1) * reviewProblemPageSize,
    normalizedReviewProblemPage * reviewProblemPageSize,
  );
  useEffect(() => {
    setReviewProblemPage((current) => Math.min(current, reviewProblemTotalPages));
  }, [reviewProblemTotalPages]);
  const summaryLines = [
    ["Status", competitionStatusLabel(competitionStatus)],
    ["Competition type", draftState.type],
    ["Format", draftState.format],
    ["Selected problems", String(selectedProblemCount)],
    ["Attempts", String(draftState.attemptsAllowed)],
    ["Answer key visibility", draftState.answerKeyVisibility],
  ] as const;
  const stepProgress = STEP_PROGRESS_CONFIG[activeStep];
  const stepNav = getStepNavigation(activeStep);

  return (
    <div
      className={cn(
        "grid gap-8",
        isImmersiveStep ? "" : "2xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]",
      )}
    >
      <div className="min-w-0 space-y-6">
        <div className="w-full rounded-[30px] border border-[#f3d7aa] bg-white p-8 shadow-[0_18px_50px_rgba(15,18,26,0.06)]">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="text-[13px] font-black uppercase tracking-[0.22em] text-[#f49700]">
                Step {stepProgress.visualStep} of {stepProgress.totalSteps}
              </div>
              <h1 className="text-[28px] font-black leading-tight text-[#10182b] md:text-[32px]">
                {stepProgress.title}
              </h1>
              <p className="max-w-2xl text-[15px] font-medium text-slate-500">
                {stepProgress.description}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-black leading-none text-[#10182b]">
                {stepProgress.percentage}%
              </div>
              <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Completed
              </div>
            </div>
          </div>
          <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#f49700] shadow-[0_0_12px_rgba(244,151,0,0.45)] transition-all duration-500"
              style={{ width: `${stepProgress.percentage}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STEP_ORDER.map((stepId) => {
              const isActive = stepId === activeStep || (activeStep === "format" && stepId === "schedule") || (activeStep === "schedule" && stepId === "format");
              const step = WIZARD_STEPS.find(s => s.id === stepId);
              if (stepId === "format") return null;
              return (
                <button
                  key={stepId}
                  type="button"
                  onClick={() => setActiveStep(stepId)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[13px] font-bold transition-all",
                    isActive
                      ? "bg-[#10182b] text-white shadow-md"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[#10182b]"
                  )}
                >
                  {step?.title ?? stepId}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "edit" && !isEditable ? (
          <div className="bg-[#f49700]/10 rounded-2xl border border-[#f49700]/20 p-5 flex items-start gap-3">
            <Info className="mt-0.5 w-5 h-5 shrink-0 text-[#f49700]" />
            <div className="flex flex-col gap-1">
              <span className="text-[#10182b] font-bold text-[14px]">This competition is read-only now.</span>
              <span className="text-slate-600 text-[13px] font-medium leading-relaxed">
                Drafts can still be edited. Published, live, ended, and archived competitions keep frozen problem
                and scoring snapshots.
              </span>
            </div>
          </div>
        ) : null}

        {activeStep === "overview" && (
        <section id="overview" className="scroll-mt-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-[#10182b] font-black text-[18px] mb-1">Competition Overview</h2>
            <p className="text-slate-500 text-[13px] font-medium mb-6">Define the name, rules, and instructions for your competition.</p>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-name" className="text-[#10182b] font-bold text-[14px]">Competition name</label>
                  <Input
                    id="competition-name"
                    value={draftState.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    aria-invalid={Boolean(formErrorLookup.get("name"))}
                    disabled={!isEditable && mode === "edit"}
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                  {formErrorLookup.get("name") ? (
                    <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("name")}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-description" className="text-[#10182b] font-bold text-[14px]">Description</label>
                  <textarea
                    id="competition-description"
                    value={draftState.description}
                    onChange={(event) => updateDraft("description", event.target.value)}
                    className="w-full min-h-28 bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all resize-y"
                    aria-invalid={Boolean(formErrorLookup.get("description"))}
                    disabled={!isEditable && mode === "edit"}
                  />
                  {formErrorLookup.get("description") ? (
                    <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("description")}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-instructions" className="text-[#10182b] font-bold text-[14px]">Rules and instructions</label>
                  <textarea
                    id="competition-instructions"
                    value={draftState.instructions}
                    onChange={(event) => updateDraft("instructions", event.target.value)}
                    className="w-full min-h-36 bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all resize-y"
                    aria-invalid={Boolean(formErrorLookup.get("instructions"))}
                    disabled={!isEditable && mode === "edit"}
                  />
                  {formErrorLookup.get("instructions") ? (
                    <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("instructions")}</p>
                  ) : null}
                </div>
              </div>
          </div>
        </section>
        )}

        {(activeStep === "schedule" || activeStep === "format") && (
        <>
        <section id="schedule" className="scroll-mt-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-[#10182b] font-black text-[18px] mb-1">Schedule & Timing</h2>
            <p className="text-slate-500 text-[13px] font-medium mb-6">Choose competition type, timing, and registration windows.</p>
            <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-type" className="text-[#10182b] font-bold text-[14px]">Competition type</label>
                  <select
                    id="competition-type"
                    value={draftState.type}
                    onChange={(event) => setCompetitionType(event.target.value === "open" ? "open" : "scheduled")}
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                    disabled={!isEditable && mode === "edit"}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="open">Open</option>
                  </select>
                  {formErrorLookup.get("type") ? (
                    <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("type")}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-duration" className="text-[#10182b] font-bold text-[14px]">Duration (Min)</label>
                  <Input
                    id="competition-duration"
                    type="number"
                    min={1}
                    value={draftState.durationMinutes}
                    onChange={(event) => updateDraft("durationMinutes", Number.parseInt(event.target.value, 10) || 1)}
                    disabled={!isEditable && mode === "edit"}
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                </div>

                {draftState.type === "scheduled" ? (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label htmlFor="registration-timing-mode" className="text-[#10182b] font-bold text-[14px]">Registration timing</label>
                    <select
                      id="registration-timing-mode"
                      value={draftState.registrationTimingMode}
                      onChange={(event) =>
                        setRegistrationTimingMode(event.target.value === "manual" ? "manual" : "default")
                      }
                      className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                      disabled={!isEditable && mode === "edit"}
                    >
                      <option value="default">Default: open until competition start</option>
                      <option value="manual">Manual registration window</option>
                    </select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <label htmlFor="registration-start" className="text-[#10182b] font-bold text-[14px]">Registration start</label>
                  <Input
                    id="registration-start"
                    type="datetime-local"
                    value={draftState.registrationStart}
                    onChange={(event) => updateDraft("registrationStart", event.target.value)}
                    disabled={
                      draftState.type !== "scheduled" ||
                      draftState.registrationTimingMode !== "manual" ||
                      (!isEditable && mode === "edit")
                    }
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="registration-end" className="text-[#10182b] font-bold text-[14px]">Registration end</label>
                  <Input
                    id="registration-end"
                    type="datetime-local"
                    value={computedRegistrationEndLocal}
                    onChange={(event) => updateDraft("registrationEnd", event.target.value)}
                    disabled={
                      draftState.type !== "scheduled" ||
                      draftState.registrationTimingMode !== "manual" ||
                      (!isEditable && mode === "edit")
                    }
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                  {draftState.type === "scheduled" && draftState.registrationTimingMode === "default" ? (
                    <p className="text-slate-400 text-[12px] font-medium">
                      Default mode keeps registration open until competition start.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-start" className="text-[#10182b] font-bold text-[14px]">Competition start</label>
                  <Input
                    id="competition-start"
                    type="datetime-local"
                    value={draftState.startTime}
                    onChange={(event) => updateDraft("startTime", event.target.value)}
                    disabled={draftState.type !== "scheduled" || (!isEditable && mode === "edit")}
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-end" className="text-[#10182b] font-bold text-[14px]">Competition end</label>
                  <Input
                    id="competition-end"
                    type="datetime-local"
                    value={computedScheduledEndLocal}
                    readOnly
                    disabled={draftState.type !== "scheduled" || (!isEditable && mode === "edit")}
                    placeholder="Set start and duration to compute end"
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                  {draftState.type === "scheduled" ? (
                    <p className="text-slate-400 text-[12px] font-medium">Computed from competition start plus duration.</p>
                  ) : null}
                </div>
              </div>

              {scheduleErrors.length > 0 ? (
                <div className="mt-6 bg-amber-50 rounded-2xl border border-amber-200 p-5">
                  <p className="text-[#10182b] font-bold text-[14px]">Schedule needs attention before save or publish.</p>
                  <ul className="mt-2 space-y-1 text-amber-900 text-[13px] font-medium list-disc pl-4">
                    {scheduleErrors.map((error) => (
                      <li key={`${error.field}:${error.reason}`}>{error.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6 bg-[#f49700]/10 rounded-2xl p-5 flex items-start gap-3 border border-[#f49700]/20">
                <Info className="w-5 h-5 text-[#f49700] shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-[#10182b] font-bold text-[14px]">Schedule Info</span>
                  <span className="text-slate-600 text-[13px] font-medium leading-relaxed">
                    {draftState.type === "scheduled"
                      ? draftState.registrationTimingMode === "manual"
                        ? "Manual mode requires explicit registration start and end. Registration must close at or before competition start."
                        : "Default mode keeps registration open until competition start."
                      : "Open competitions clear registration windows and scheduled start times. They use manual lifecycle controls instead."}
                  </span>
                </div>
              </div>
          </div>
        </section>

        <section id="format" className="scroll-mt-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-[#10182b] font-black text-[18px] mb-1">Competition Format</h2>
            <p className="text-slate-500 text-[13px] font-medium mb-6">Participant capacity, attempts, and answer-key visibility.</p>
            <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="competition-format" className="text-[#10182b] font-bold text-[14px]">Format</label>
                  <select
                    id="competition-format"
                    value={draftState.format}
                    onChange={(event) =>
                      setDraftState((current) => {
                        const nextFormat = event.target.value === "team" ? "team" : "individual";
                        return nextFormat === "team"
                          ? { ...current, format: nextFormat, maxParticipants: null, participantsPerTeam: current.participantsPerTeam ?? 2, maxTeams: current.maxTeams ?? 3 }
                          : { ...current, format: nextFormat, maxParticipants: current.maxParticipants ?? 3, participantsPerTeam: null, maxTeams: null };
                      })
                    }
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                    disabled={!isEditable && mode === "edit"}
                  >
                    <option value="individual">Individual</option>
                    <option value="team">Team</option>
                  </select>
                  {formErrorLookup.get("format") ? (
                    <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("format")}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="attempts-allowed" className="text-[#10182b] font-bold text-[14px]">Attempts allowed</label>
                  <Input
                    id="attempts-allowed"
                    type="number"
                    min={1}
                    max={3}
                    value={draftState.attemptsAllowed}
                    onChange={(event) => updateDraft("attemptsAllowed", Number.parseInt(event.target.value, 10) || 1)}
                    disabled={!isEditable && mode === "edit"}
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                  />
                  {formErrorLookup.get("attemptsAllowed") ? (
                    <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("attemptsAllowed")}</p>
                  ) : null}
                </div>

                {draftState.format === "individual" ? (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label htmlFor="max-participants" className="text-[#10182b] font-bold text-[14px]">Max participants</label>
                    <Input
                      id="max-participants"
                      type="number"
                      min={3}
                      max={100}
                      value={maxParticipantsInput}
                      onChange={(event) => { setMaxParticipantsInput(event.target.value); setStatus("idle"); setStatusMessage(null); }}
                      onBlur={() => commitMaxParticipantsInput(maxParticipantsInput)}
                      onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); commitMaxParticipantsInput(maxParticipantsInput); event.currentTarget.blur(); }}
                      disabled={!isEditable && mode === "edit"}
                      className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                    />
                    <p className="text-slate-400 text-[12px] font-medium">Validation: Min 3, Max 100</p>
                    {formErrorLookup.get("maxParticipants") ? (
                      <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("maxParticipants")}</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="participants-per-team" className="text-[#10182b] font-bold text-[14px]">Participants per team</label>
                      <Input
                        id="participants-per-team"
                        type="number"
                        min={2}
                        max={5}
                        value={draftState.participantsPerTeam ?? 2}
                        onChange={(event) => updateDraft("participantsPerTeam", Number.parseInt(event.target.value, 10) || 2)}
                        disabled={!isEditable && mode === "edit"}
                        className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                      />
                      {formErrorLookup.get("participantsPerTeam") ? (
                        <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("participantsPerTeam")}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="max-teams" className="text-[#10182b] font-bold text-[14px]">Max teams</label>
                      <Input
                        id="max-teams"
                        type="number"
                        min={3}
                        max={50}
                        value={draftState.maxTeams ?? 3}
                        onChange={(event) => updateDraft("maxTeams", Number.parseInt(event.target.value, 10) || 3)}
                        disabled={!isEditable && mode === "edit"}
                        className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto"
                      />
                      {formErrorLookup.get("maxTeams") ? (
                        <p className="text-red-500 text-[12px] font-bold">{formErrorLookup.get("maxTeams")}</p>
                      ) : null}
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label htmlFor="answer-key-visibility" className="text-[#10182b] font-bold text-[14px]">Answer-key visibility</label>
                  <select
                    id="answer-key-visibility"
                    value={draftState.answerKeyVisibility}
                    onChange={(event) => updateDraft("answerKeyVisibility", event.target.value === "hidden" ? "hidden" : "after_end")}
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                    disabled={!isEditable && mode === "edit"}
                  >
                    <option value="after_end">After end</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
          </div>
        </section>
        </>
        )}

        {activeStep === "problems" ? (
          <section id="problems-redesign" className="scroll-mt-24 space-y-6">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="grid xl:grid-cols-[minmax(0,1.08fr)_390px]">
                <div className="min-w-0 border-b border-slate-200 xl:border-b-0 xl:border-r">
                  <div className="space-y-5 border-b border-slate-100 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-[18px] font-black text-[#10182b]">Available problems</h2>
                        <p className="mt-1 text-[13px] font-medium text-slate-500">
                          Search by bank, tag, type, or difficulty and build your publish-ready set.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftState((current) => ({
                            ...current,
                            selectedProblemIds: [],
                            customPointsByProblemId: {},
                          }))
                        }
                        disabled={!isEditable && mode === "edit"}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:border-[#f49700] hover:text-[#f49700] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CopyPlus className="h-4 w-4" />
                        Clear selection
                      </button>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#10182b] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          Finder
                        </span>
                        <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Narrow your bank and problem list
                        </span>
                      </div>

                      <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-2">
                          <label htmlFor="problem-search-redesign" className="text-[13px] font-bold text-[#10182b]">
                            Search
                          </label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              id="problem-search-redesign"
                              value={problemSearch}
                              onChange={(event) => setProblemSearch(event.target.value)}
                              placeholder="Search problems, tags, or difficulty..."
                              className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-[14px] font-medium text-[#10182b] placeholder:text-slate-400 focus-visible:ring-[#f49700]/30"
                            />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <label htmlFor="problem-bank-filter-redesign" className="text-[13px] font-bold text-[#10182b]">
                            Bank filter
                          </label>
                          <select
                            id="problem-bank-filter-redesign"
                            value={bankFilter}
                            onChange={(event) => setBankFilter(event.target.value)}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-medium text-[#10182b] outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
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
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-[#f49700]/20 bg-[#f49700]/5 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f49700]">
                            Visible now
                          </p>
                          <p className="mt-1 text-[20px] font-black leading-none text-[#10182b]">
                            {filteredProblems.length}
                          </p>
                        </div>
                        <p className="text-[12px] font-bold text-slate-500">
                          Search results update instantly as you filter.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            addProblemIds(visibleProblemIds);
                            setExpandedBankIds((prev) => {
                              const next = { ...prev };
                              groupedVisibleProblems.forEach((group) => {
                                next[group.bankId] = false;
                              });
                              return next;
                            });
                          }}
                          disabled={!isEditable || visibleProblemIds.length === 0}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-[#10182b] transition-colors hover:border-[#f49700] hover:bg-[#f49700]/5 hover:text-[#f49700] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Select all visible
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeProblemIds(visibleProblemIds);
                            setExpandedBankIds((prev) => {
                              const next = { ...prev };
                              groupedVisibleProblems.forEach((group) => {
                                next[group.bankId] = false;
                              });
                              return next;
                            });
                          }}
                          disabled={!isEditable || visibleProblemIds.length === 0}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove all visible
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[740px] space-y-4 overflow-y-auto bg-slate-50/60 p-6">
                    {groupedVisibleProblems.map((group) => {
                      const bankProblemIds = group.problems.map((problem) => problem.id);
                      const selectedInBank = group.problems.filter((problem) =>
                        selectedProblemSet.has(problem.id),
                      ).length;
                      const expanded = expandedBankIds[group.bankId] ?? false;
                      const allSelected =
                        group.problems.length > 0 && selectedInBank === group.problems.length;

                      return (
                        <div
                          key={group.bankId}
                          className={cn(
                            "overflow-hidden rounded-[22px] border bg-white shadow-sm transition-all",
                            selectedInBank > 0
                              ? "border-[#f49700]/35 shadow-[0_12px_30px_rgba(244,151,0,0.08)]"
                              : "border-slate-200",
                          )}
                        >
                          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: !expanded }))
                              }
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <div
                                className={cn(
                                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                                  selectedInBank > 0
                                    ? "border-[#f49700]/20 bg-[#f49700]/10 text-[#f49700]"
                                    : "border-slate-200 bg-slate-100 text-slate-500",
                                )}
                              >
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-[15px] font-bold text-[#10182b]">
                                    {group.bankName}
                                  </p>
                                  {selectedInBank > 0 ? (
                                    <span className="rounded-full bg-[#10182b] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[12px] font-medium text-slate-400">
                                  {selectedInBank} of {group.problems.length} problems selected
                                </p>
                              </div>
                            </button>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  addProblemIds(bankProblemIds);
                                  setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: false }));
                                }}
                                disabled={!isEditable || allSelected}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-[#10182b] transition-colors hover:border-[#f49700] hover:bg-[#f49700]/5 hover:text-[#f49700] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  removeProblemIds(bankProblemIds);
                                  setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: false }));
                                }}
                                disabled={!isEditable || selectedInBank === 0}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Remove all
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: !expanded }))
                                }
                                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-[#10182b]"
                                aria-label={expanded ? "Collapse bank" : "Expand bank"}
                              >
                                {expanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {expanded ? (
                            <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-4">
                              {group.problems.map((problem) => {
                                const isSelected = selectedProblemSet.has(problem.id);
                                return (
                                  <button
                                    key={problem.id}
                                    type="button"
                                    onClick={() => toggleProblem(problem.id)}
                                    disabled={!isEditable && mode === "edit"}
                                    className={cn(
                                      "w-full rounded-2xl border p-4 text-left transition-all",
                                      isSelected
                                        ? "border-[#f49700] bg-[#f49700]/5 ring-1 ring-[#f49700]/15"
                                        : "border-slate-200 bg-white hover:border-slate-300",
                                      !isEditable && mode === "edit" ? "cursor-not-allowed opacity-70" : "",
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                            {problem.difficulty}
                                          </span>
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                            {problem.type}
                                          </span>
                                        </div>
                                        <p className="line-clamp-2 break-all text-[14px] font-semibold leading-6 text-[#10182b]">
                                          {problem.contentLatex || "Untitled problem"}
                                        </p>
                                        <p className="break-words text-[12px] font-medium text-slate-500">
                                          {problem.tags.join(" | ") || "No tags"}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2 text-[12px] font-bold text-slate-400">
                                        <GripVertical className="h-4 w-4" />
                                        {isSelected ? "Selected" : "Add"}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {groupedVisibleProblems.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-200 bg-white p-8 text-center">
                        <p className="text-sm font-bold text-[#10182b]">No problems match current filters</p>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          Clear the search or switch banks to see more problems.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="bg-[#fafafb]">
                  <div className="sticky top-0 z-10 space-y-4 border-b border-slate-200 bg-[#fafafb] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[18px] font-black text-[#10182b]">Selected problems</p>
                        <p className="mt-1 text-[13px] font-medium text-slate-500">
                          {selectedProblemCount} selected across {selectedBankCount} bank
                          {selectedBankCount === 1 ? "" : "s"}.
                        </p>
                      </div>
                      <div
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]",
                          isProblemSelectionReady
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-[#f49700]/10 text-[#f49700]",
                        )}
                      >
                        {selectedProblemCount}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-[#f49700]/20 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f49700]">
                          Progress
                        </p>
                        <p className="mt-2 text-[28px] font-black leading-none text-[#10182b]">
                          {selectedProblemCount}
                        </p>
                        <p className="mt-2 text-[12px] font-medium text-slate-500">
                          Selected problems
                        </p>
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Banks used
                        </p>
                        <p className="mt-2 text-[28px] font-black leading-none text-[#10182b]">
                          {selectedBankCount}
                        </p>
                        <p className="mt-2 text-[12px] font-medium text-slate-500">
                          Distinct banks represented
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Publish readiness
                          </p>
                          <p className="mt-2 text-[15px] font-bold text-[#10182b]">
                            {isProblemSelectionReady
                              ? "Ready to publish from a problem-count perspective."
                              : "Publish requires between 10 and 100 selected problems."}
                          </p>
                        </div>
                        <span className="text-[24px] font-black text-[#10182b]">
                          {selectedProblemCount}
                        </span>
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isProblemSelectionReady ? "bg-emerald-500" : "bg-[#f49700]",
                          )}
                        style={{ width: `${selectedProblemProgress}%` }}
                      />
                    </div>
                      <p className="mt-3 text-[12px] font-medium text-slate-500">
                        {selectedProblemCount < 10
                          ? `${10 - selectedProblemCount} more problem(s) needed to reach the minimum.`
                          : selectedProblemCount > 100
                            ? `${selectedProblemCount - 100} problem(s) above the maximum publish limit.`
                            : "Problem count is within the publish range."}
                      </p>
                    </div>
                  </div>

                  <div className="max-h-[740px] space-y-3 overflow-y-auto p-5">
                    {selectedProblems.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
                        <p className="text-base font-bold text-[#10182b]">No problems selected</p>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          Add problems from the left pane to build the competition snapshot.
                        </p>
                      </div>
                    ) : (
                      selectedProblems.map((problem, index) => (
                        <div
                          key={problem.id}
                          className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[#f49700]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f49700]">
                                    {problem.bankName}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    {problem.difficulty}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 break-all text-[14px] font-semibold leading-6 text-[#10182b]">
                                  {problem.contentLatex || "Untitled problem"}
                                </p>
                                <p className="mt-1 break-words text-[12px] font-medium text-slate-500">
                                  {problem.type} | {problem.tags.join(" | ") || "No tags"}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-col gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => moveSelectedProblem(problem.id, -1)}
                                  disabled={index === 0}
                                  aria-label="Move selected problem up"
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-[#10182b] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSelectedProblem(problem.id, 1)}
                                  disabled={index === selectedProblems.length - 1}
                                  aria-label="Move selected problem down"
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:text-[#10182b] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleProblem(problem.id)}
                                  disabled={!isEditable && mode === "edit"}
                                  aria-label="Remove selected problem"
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {draftState.scoringMode === "custom" ? (
                              <div className="grid max-w-48 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <Label
                                  htmlFor={`custom-points-${problem.id}-redesign`}
                                  className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400"
                                >
                                  Custom points
                                </Label>
                                <Input
                                  id={`custom-points-${problem.id}-redesign`}
                                  type="number"
                                  min={0}
                                  value={
                                    draftState.customPointsByProblemId[problem.id] ??
                                    getSuggestedProblemPoints(problem)
                                  }
                                  onChange={(event) => updateCustomPoint(problem.id, event.target.value)}
                                  disabled={!isEditable && mode === "edit"}
                                  className="h-11 rounded-xl border-slate-200 bg-slate-50"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {publishErrorLookup.get("selectedProblemIds") ? (
              <p className="text-[12px] font-bold text-red-500">
                {publishErrorLookup.get("selectedProblemIds")}
              </p>
            ) : null}
          </section>
        ) : null}

        {false && activeStep === "problems" && (
        <section id="problems" className="scroll-mt-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h2 className="text-[#10182b] font-black text-[18px] mb-1">Competition Problems</h2>
            <p className="text-slate-500 text-[13px] font-medium mb-6">Select, search, and order problems before publish.</p>
            <div className="space-y-6">
            <div className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={problemSearch}
                    onChange={(event) => setProblemSearch(event.target.value)}
                    placeholder="Search problems, tags, or difficulty..."
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-10 pr-4 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all h-auto placeholder:text-slate-400"
                  />
                </div>

                <div className="grid gap-2 min-w-0">
                  <label htmlFor="problem-bank-filter" className="text-[#10182b] font-bold text-[14px] truncate">Bank filter</label>
                  <select
                    id="problem-bank-filter"
                    value={bankFilter}
                    onChange={(event) => setBankFilter(event.target.value)}
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-4 pr-10 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all truncate"
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
                  onClick={() => {
                    addProblemIds(visibleProblemIds);
                    setExpandedBankIds((prev) => {
                      const next = { ...prev };
                      groupedVisibleProblems.forEach((group) => {
                        next[group.bankId] = false;
                      });
                      return next;
                    });
                  }}
                  disabled={!isEditable || visibleProblemIds.length === 0}
                >
                  Select all visible
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    removeProblemIds(visibleProblemIds);
                    setExpandedBankIds((prev) => {
                      const next = { ...prev };
                      groupedVisibleProblems.forEach((group) => {
                        next[group.bankId] = true;
                      });
                      return next;
                    });
                  }}
                  disabled={!isEditable || visibleProblemIds.length === 0}
                >
                  Remove all visible
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
                    {groupedVisibleProblems.map((group) => {
                      const bankProblemIds = group.problems.map((problem) => problem.id);
                      const selectedInBank = group.problems.filter((problem) => selectedProblemSet.has(problem.id)).length;
                      const expanded = expandedBankIds[group.bankId] ?? (selectedInBank < group.problems.length);

                      return (
                        <div key={group.bankId} className="rounded-xl border border-border/60 bg-background/60 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto flex-1 justify-start px-0 py-0 text-left"
                              onClick={() => setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: !expanded }))}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">{group.bankName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {selectedInBank} of {group.problems.length} selected
                                </p>
                              </div>
                            </Button>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  addProblemIds(bankProblemIds);
                                  setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: false }));
                                }}
                                disabled={!isEditable || bankProblemIds.length === 0}
                              >
                                Select bank
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  removeProblemIds(bankProblemIds);
                                  setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: true }));
                                }}
                                disabled={!isEditable || bankProblemIds.length === 0}
                              >
                                Remove bank
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setExpandedBankIds((prev) => ({ ...prev, [group.bankId]: !expanded }))}
                                aria-label={expanded ? "Collapse bank" : "Expand bank"}
                              >
                                {expanded ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                              </Button>
                            </div>
                          </div>

                          {expanded ? (
                            <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                              {group.problems.map((problem) => {
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
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {groupedVisibleProblems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                        No problems match current filters.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {publishErrorLookup.get("selectedProblemIds") ? (
                <p className="text-red-500 text-[12px] font-bold">{publishErrorLookup.get("selectedProblemIds")}</p>
              ) : null}
            </div>
          </div>
        </section>
        )}

        {activeStep === "scoring" ? (
          <section id="scoring-redesign" className="scroll-mt-24 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
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
                validationErrors={
                  draftValidation.ok
                    ? []
                    : draftValidation.errors.filter((error) =>
                        [
                          "scoringMode",
                          "penaltyMode",
                          "deductionValue",
                          "tieBreaker",
                          "multiAttemptGradingMode",
                          "customPointsByProblemId",
                          "offensePenalties",
                        ].includes(error.field),
                      )
                }
                disabled={!isEditable && mode === "edit"}
              />

              <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                <ScoringSummaryCard
                  config={scoringConfig}
                  context="wizard"
                  options={{
                    competitionType: draftState.type,
                    selectedProblemCount,
                  }}
                />

                <div className="rounded-[28px] border border-[#f49700]/20 bg-[#f49700]/5 p-5 shadow-sm">
                  <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#f49700]">
                    Snapshot reminder
                  </p>
                  <p className="mt-3 text-[14px] font-medium leading-6 text-slate-700">
                    Publish locks the scoring contract and problem ordering exactly as shown here.
                    Review manual points in the previous step before moving on.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {false && activeStep === "scoring" && (
        <section id="scoring" className="scroll-mt-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8">
              <h2 className="text-[#10182b] font-black text-[18px] mb-1">Competition Scoring</h2>
              <p className="text-slate-500 text-[13px] font-medium mb-6">Set scoring contract, penalties, and anti-cheat behavior.</p>
            <div className="space-y-6">
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
            </div>
            </div>
          </div>
        </section>
        )}

        {activeStep === "review" ? (
          <section id="review-redesign" className="scroll-mt-24 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    Core information
                  </h3>
                  <div className="mt-6 space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f49700]/10 text-[#f49700]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Description
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-[#10182b]">
                          {draftState.description || "No description added yet"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f49700]/10 text-[#f49700]">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Participation
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-[#10182b]">
                          {participationSummary}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f49700]/10 text-[#f49700]">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Point system
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-[#10182b]">
                          {scoringSummaryView.lines[0]?.value}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.22em] text-slate-400">
                      Schedule
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveStep(draftState.type === "scheduled" ? "schedule" : "format")}
                      className="text-[13px] font-bold text-[#f49700] transition-colors hover:text-[#d87d00]"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-[14px] font-medium text-slate-500">Registration</span>
                      <span className="text-right text-[14px] font-bold text-[#10182b]">
                        {registrationSummary}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-[14px] font-medium text-slate-500">Competition window</span>
                      <span className="text-right text-[14px] font-bold text-[#10182b]">
                        {competitionWindowSummary}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[14px] font-medium text-slate-500">Duration</span>
                      <span className="text-[14px] font-bold text-[#10182b]">
                        {draftState.durationMinutes} minute{draftState.durationMinutes === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#ebdcc1] bg-[#f9f5ed] p-8 shadow-sm">
                  <h3 className="text-[16px] font-black text-[#10182b]">Quick stats</h3>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                      <p className="text-[32px] font-black leading-none text-[#f49700]">
                        {selectedProblemCount}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Total problems
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                      <p className="text-[32px] font-black leading-none text-[#f49700]">
                        {totalPossiblePoints}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Total points
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-4 border-b border-slate-100 p-8">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-black text-[#10182b]">Problem bank preview</h2>
                    <p className="mt-1 text-[13px] font-medium text-slate-500">
                      {selectedProblemCount} problem{selectedProblemCount === 1 ? "" : "s"} currently selected for snapshot.
                    </p>
                  </div>
                </div>

                <div className="space-y-6 p-8">
                  {reviewPreviewProblems.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-200 p-8 text-center">
                      <p className="text-base font-bold text-[#10182b]">No selected problems yet</p>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        Add problems before creating or publishing the competition.
                      </p>
                    </div>
                  ) : (
                    reviewPreviewProblems.map((problem, index) => (
                      <div key={problem.id} className="relative rounded-[24px] border border-slate-200 p-6 shadow-sm">
                        <div className="absolute -top-3 left-6 rounded-full bg-[#f49700] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-sm">
                          {problem.bankName}
                        </div>
                        <p className="text-[18px] font-black text-[#10182b]">
                          Problem {(normalizedReviewProblemPage - 1) * reviewProblemPageSize + index + 1}
                        </p>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <KatexPreview
                            latex={problem.contentLatex || ""}
                            label="Problem preview"
                            displayMode={false}
                            className="[&>p:first-child]:text-[10px] [&>p:first-child]:font-black [&>p:first-child]:tracking-[0.18em] [&>p:first-child]:text-slate-400 [&_.katex]:text-[#10182b] [&_.katex-display]:text-[#10182b] [&_div.min-w-0.rounded-md]:border-slate-200 [&_div.min-w-0.rounded-md]:bg-white [&_div.min-w-0.rounded-md]:p-4 [&_div.w-max]:text-[#10182b]"
                            fallbackText="Untitled problem"
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                            {draftState.scoringMode === "custom"
                              ? `${draftState.customPointsByProblemId[problem.id] ?? getSuggestedProblemPoints(problem)} points`
                              : `${getSuggestedProblemPoints(problem)} points`}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                            Difficulty: {problem.difficulty}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                            Type: {problem.type}
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  {selectedProblems.length > 0 ? (
                    <div className="mt-2 border-t border-slate-100 pt-6">
                      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="text-[13px] font-medium text-slate-500">
                          Showing {(normalizedReviewProblemPage - 1) * reviewProblemPageSize + 1}-
                          {Math.min(
                            normalizedReviewProblemPage * reviewProblemPageSize,
                            selectedProblems.length,
                          )}{" "}
                          of {selectedProblems.length} selected problems
                        </div>
                        {reviewProblemTotalPages > 1 ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setReviewProblemPage((current) => Math.max(1, current - 1))
                              }
                              disabled={normalizedReviewProblemPage === 1}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-slate-300 hover:text-[#10182b] disabled:opacity-40"
                              aria-label="Previous review page"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            {Array.from({ length: reviewProblemTotalPages }, (_, index) => index + 1).map((page) => (
                              <button
                                key={page}
                                type="button"
                                onClick={() => setReviewProblemPage(page)}
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-xl text-[14px] font-bold transition-all",
                                  page === normalizedReviewProblemPage
                                    ? "bg-[#f49700] text-[#10182b] shadow-sm shadow-[#f49700]/20"
                                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#10182b]",
                                )}
                                aria-label={`Go to review page ${page}`}
                              >
                                {page}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setReviewProblemPage((current) =>
                                  Math.min(reviewProblemTotalPages, current + 1),
                                )
                              }
                              disabled={normalizedReviewProblemPage === reviewProblemTotalPages}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-slate-300 hover:text-[#10182b] disabled:opacity-40"
                              aria-label="Next review page"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {draftValidation.ok && draftValidation.value ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-[14px] font-bold text-green-800">
                      Draft validation passed. Ready to {mode === "create" ? "create" : "save"}.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[14px] font-bold text-amber-900">
                      Resolve validation issues before saving or publishing.
                    </div>
                  )}

                  {statusMessage ? (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 text-[14px] font-bold",
                        status === "error"
                          ? "border-red-200 bg-red-50 text-red-600"
                          : status === "saving"
                            ? "border-slate-200 bg-slate-50 text-slate-500"
                            : "border-green-200 bg-green-50 text-green-800",
                      )}
                    >
                      {statusMessage}
                    </div>
                  ) : null}

                  {mode === "edit" ? (
                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          onClick={() => void saveDraft()}
                          pending={savingAction === "save"}
                          pendingText="Saving..."
                          disabled={!isEditable || draftValidation.ok === false}
                          className="rounded-xl bg-[#10182b] text-white hover:bg-[#0f121a]"
                        >
                          <CheckCircle2 className="size-4" />
                          Save draft
                        </Button>

                        <Button
                          type="button"
                          variant="default"
                          onClick={() => setPublishConfirmOpen(true)}
                          disabled={!canPublish}
                          className="rounded-xl bg-[#f49700] text-[#10182b] hover:bg-[#e08900]"
                        >
                          <Send className="size-4" />
                          Publish
                        </Button>

                        <Button type="button" variant="outline" onClick={() => setStartConfirmOpen(true)} disabled={!canStart} className="rounded-xl border-slate-200">
                          <Play className="size-4" />
                          Start
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEndConfirmOpen(true)} disabled={!canEnd} className="rounded-xl border-slate-200">
                          <Clock3 className="size-4" />
                          End
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setArchiveConfirmOpen(true)} disabled={!canArchive} className="rounded-xl border-slate-200">
                          <Archive className="size-4" />
                          Archive
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => setDeleteConfirmOpen(true)} disabled={!canDelete} className="rounded-xl">
                          <Trash2 className="size-4" />
                          Delete draft
                        </Button>
                      </div>

                      <p className="text-xs font-medium text-slate-500">
                        Draft revision {draftRevision}. Published and later statuses become read-only.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => void submitCreateDraft()}
                        pending={savingAction === "create"}
                        pendingText="Creating..."
                        className="rounded-xl bg-[#10182b] text-white hover:bg-[#0f121a]"
                      >
                        <Sparkles className="size-4" />
                        Create draft
                      </Button>
                      <ProgressLink
                        href="/organizer/competition"
                        className="text-sm font-semibold text-[#f49700] underline-offset-4 hover:underline"
                      >
                        Back to competition list
                      </ProgressLink>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {false && activeStep === "review" && (
        <section id="review" className="scroll-mt-24 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-[#10182b] font-black text-[18px] mb-1">Competition Review</h2>
            <p className="text-slate-500 text-[13px] font-medium mb-6">Confirm final draft state before create, save, or publish.</p>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryLines.map(([label, value]) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">{label}</p>
                    <p className="mt-2 text-[#10182b] text-[15px] font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {draftValidation.ok && draftValidation.value ? (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-5 text-green-800 text-[14px] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Draft validation passed. Ready to {mode === "create" ? "create" : "save"}.
                </div>
              ) : (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-amber-900 text-[14px] font-bold">
                  Resolve validation issues before saving or publishing.
                </div>
              )}

              {mode === "edit" ? (
                <div className="space-y-4 bg-slate-50 rounded-2xl border border-slate-200 p-6">
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
                    "rounded-2xl border p-5 text-[14px] font-bold",
                    status === "error"
                      ? "border-red-200 bg-red-50 text-red-600"
                      : status === "saving"
                        ? "border-slate-200 bg-slate-50 text-slate-500"
                        : "border-green-200 bg-green-50 text-green-800",
                  )}
                >
                  {statusMessage}
                </div>
              ) : null}
            </div>
          </div>
        </section>
        )}

        {/* Step Navigation Footer */}
        <div className="mb-8 mt-4 flex w-full items-center justify-between">
          {stepNav.prevStep ? (
            <button
              type="button"
              onClick={() => setActiveStep(stepNav.prevStep!)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-[14px] font-bold text-[#10182b] shadow-sm transition-all hover:border-slate-300"
            >
              <ArrowLeft className="w-4 h-4" /> {stepNav.prevLabel ?? "Back"}
            </button>
          ) : (
            <div />
          )}
          {stepNav.nextStep ? (
            <button
              type="button"
              onClick={() => setActiveStep(stepNav.nextStep!)}
              className="flex items-center gap-2 rounded-xl bg-[#f49700] px-8 py-3.5 text-[15px] font-bold text-[#10182b] shadow-sm transition-all hover:bg-[#e08900] hover:shadow-lg hover:shadow-[#f49700]/30"
            >
              Continue to {stepNav.nextLabel ?? "Next"} <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {!isImmersiveStep ? (
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
      ) : null}

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

          const draftStateForSubmit = getDraftStateForSubmit();
          if (draftStateForSubmit !== draftState) {
            setDraftState(draftStateForSubmit);
          }

          const submitValidation = validateCompetitionDraftInput(draftStateForSubmit);
          if (!submitValidation.ok || !submitValidation.value) {
            setStatus("error");
            setStatusMessage(buildValidationStatusMessage("Fix validation issues before publishing.", submitValidation.errors));
            focusFirstValidationField(submitValidation.errors);
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
                ...submitValidation.value,
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
