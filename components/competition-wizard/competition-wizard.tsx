"use client";

import { useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
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
  const isEditable = competitionStatus === "draft";
  const canPublish = competitionStatus === "draft" && publishValidation.ok && publishValidation.value !== null;
  const canStart = competitionStatus === "published" && draftState.type === "open";
  const canEnd = (competitionStatus === "live" || competitionStatus === "paused") && draftState.type === "open";
  const canArchive = competitionStatus === "ended" || (competitionStatus === "paused" && draftState.type === "open");
  const canDelete = competitionStatus === "draft";

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

  function toggleProblem(problemId: string) {
    if (!isEditable && mode === "edit") {
      return;
    }

    setDraftState((current) => {
      const selected = new Set(current.selectedProblemIds);
      if (selected.has(problemId)) {
        selected.delete(problemId);
      } else {
        selected.add(problemId);
      }

      return { ...current, selectedProblemIds: Array.from(selected) };
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
          throw new Error((body?.message as string) ?? "Competition create failed.");
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
    setStatusMessage("Fix validation issues before creating draft.");
  }

  async function saveDraft() {
    if (mode !== "edit" || !competitionId) {
      return;
    }

    if (!draftValidation.ok || !draftValidation.value) {
      setStatus("error");
      setStatusMessage("Fix validation issues before saving draft.");
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
      if (!response.ok || !body) {
        throw new Error((body?.message as string) ?? "Competition save failed.");
      }

      const nextCompetition = body.competition as CompetitionRecord | undefined;
      if (nextCompetition) {
        setCompetitionStatus(nextCompetition.status);
      }

      const nextRevision = typeof body.currentDraftRevision === "number" ? body.currentDraftRevision : draftRevision;
      setDraftRevision(nextRevision);
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
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="space-y-6">
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
                    onChange={(event) =>
                      updateDraft("type", event.target.value === "open" ? "open" : "scheduled")
                    }
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

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                Scheduled competitions must provide registration and start times. Open competitions stay flexible and use manual lifecycle controls.
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
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
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
                    {Array.from(new Map(availableProblems.map((problem) => [problem.bankId, problem.bankName]))).map(
                      ([bankId, bankName]) => (
                        <option key={bankId} value={bankId}>
                          {bankName}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
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
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">{problem.bankName}</p>
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {problem.contentLatex || "Untitled problem"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {problem.type} · {problem.difficulty} · {problem.tags.join(" | ") || "No tags"}
                              </p>
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

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Available problems</p>
                      <p className="text-xs text-muted-foreground">
                        {filteredProblems.length} visible after search and bank filter.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDraftState((current) => ({ ...current, selectedProblemIds: [] }))}>
                      <CopyPlus className="size-4" />
                      Clear
                    </Button>
                  </div>

                  <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
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
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={isSelected ? "default" : "outline"}>{problem.bankName}</Badge>
                                <Badge variant="outline">{problem.difficulty}</Badge>
                                <Badge variant="outline">{problem.type}</Badge>
                              </div>
                              <p className="line-clamp-2 text-sm text-foreground">
                                {problem.contentLatex || "Untitled problem"}
                              </p>
                              <p className="text-xs text-muted-foreground">
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

              <div className="grid gap-6 xl:grid-cols-2">
                <ScoringSummaryCard
                  config={scoringConfig}
                  context="wizard"
                  options={{
                    competitionType: draftState.type,
                    selectedProblemCount,
                  }}
                />
                <ScoringSummaryCard
                  config={scoringConfig}
                  context="review"
                  options={{
                    competitionType: draftState.type,
                    selectedProblemCount,
                  }}
                />
              </div>
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
                  <div className="flex flex-wrap items-center gap-3">
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

      <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
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

          setSavingAction("publish");
          try {
            const response = await fetch(`/api/organizer/competitions/${competitionId}/publish`, {
              method: "POST",
              headers: {
                "x-idempotency-key": crypto.randomUUID(),
              },
            });

            const body = await readJsonResponse(response);
            if (!response.ok || !body) {
              throw new Error((body?.message as string) ?? "Competition publish failed.");
            }

            const nextCompetition = body.competition as CompetitionRecord | undefined;
            if (nextCompetition) {
              setCompetitionStatus(nextCompetition.status);
            }

            setStatus("saved");
            setStatusMessage("Competition published.");
            setPublishConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition publish failed.");
          } finally {
            setSavingAction(null);
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
            if (!response.ok || !body) {
              throw new Error((body?.message as string) ?? "Competition start failed.");
            }

            const nextCompetition = body.competition as CompetitionRecord | undefined;
            if (nextCompetition) {
              setCompetitionStatus(nextCompetition.status);
            }

            setStatus("saved");
            setStatusMessage("Competition started.");
            setStartConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition start failed.");
          } finally {
            setSavingAction(null);
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
            if (!response.ok || !body) {
              throw new Error((body?.message as string) ?? "Competition end failed.");
            }

            const nextCompetition = body.competition as CompetitionRecord | undefined;
            if (nextCompetition) {
              setCompetitionStatus(nextCompetition.status);
            }

            setStatus("saved");
            setStatusMessage("Competition ended.");
            setEndConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition end failed.");
          } finally {
            setSavingAction(null);
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
            if (!response.ok || !body) {
              throw new Error((body?.message as string) ?? "Competition archive failed.");
            }

            const nextCompetition = body.competition as CompetitionRecord | undefined;
            if (nextCompetition) {
              setCompetitionStatus(nextCompetition.status);
            }

            setStatus("saved");
            setStatusMessage("Competition archived.");
            setArchiveConfirmOpen(false);
          } catch (error) {
            setStatus("error");
            setStatusMessage(error instanceof Error ? error.message : "Competition archive failed.");
          } finally {
            setSavingAction(null);
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
            if (!response.ok || !body) {
              throw new Error((body?.message as string) ?? "Competition delete failed.");
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
