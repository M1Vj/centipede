"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImageMinus,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { MathliveField } from "@/components/math-editor/mathlive-field";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressLink } from "@/components/ui/progress-link";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import {
  validateProblemWriteInput,
  type ProblemWriteInput,
  type ValidatedProblemWriteInput,
} from "@/lib/problem-bank/api-helpers";
import {
  PROBLEM_DIFFICULTIES,
  PROBLEM_TYPES,
  type ProblemDifficulty,
  type ProblemOption,
  type ProblemType,
} from "@/lib/problem-bank/types";
import { validateCanonicalAcceptedAnswers } from "@/lib/problem-bank/validation";

interface ProblemFormInitialValue {
  id: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tags: string[];
  contentLatex: string;
  explanationLatex: string;
  authoringNotes: string;
  imagePath: string | null;
  imageUrl: string | null;
  options: ProblemOption[] | null;
  answerKey:
    | { correctOptionIds: string[] }
    | { acceptedAnswer: "true" | "false" }
    | { acceptedAnswers: string[] };
  updatedAt: string;
}

interface ProblemFormProps {
  bankId: string;
  backHref: string;
  initialValue?: ProblemFormInitialValue | null;
  editable?: boolean;
}

type FormStatus = {
  type: "pending" | "error" | "success";
  message: string | null;
};

const DEFAULT_TF_OPTIONS: ProblemOption[] = [
  { id: "true", label: "True" },
  { id: "false", label: "False" },
];

function createOptionId(index: number): string {
  return `opt_${index + 1}`;
}

function createDefaultMcqOptions(): ProblemOption[] {
  return [
    { id: createOptionId(0), label: "Option A" },
    { id: createOptionId(1), label: "Option B" },
  ];
}

function toPayloadErrorMessage(payload: Record<string, unknown> | null): string {
  if (!payload) {
    return "Request failed.";
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (typeof first === "string") {
      return first;
    }

    if (
      typeof first === "object" &&
      first !== null &&
      "reason" in first &&
      typeof (first as { reason?: unknown }).reason === "string"
    ) {
      return (first as { reason: string }).reason;
    }
  }

  return "Request failed.";
}

function normalizeTagsToInput(tags: string[]): string {
  return tags.join(" | ");
}

function optionListForType(type: ProblemType, options: ProblemOption[] | null): ProblemOption[] {
  if (type === "tf") {
    if (!options || options.length < 2) {
      return DEFAULT_TF_OPTIONS;
    }

    return options;
  }

  if (type === "mcq") {
    if (!options || options.length < 2) {
      return createDefaultMcqOptions();
    }

    return options;
  }

  return [];
}

export function validateProblemDraft(input: ProblemWriteInput) {
  return validateProblemWriteInput(input);
}

export function ProblemForm({
  bankId,
  backHref,
  initialValue,
  editable = true,
}: ProblemFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(initialValue?.id);

  const [type, setType] = useState<ProblemType>(initialValue?.type ?? "mcq");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>(
    initialValue?.difficulty ?? "average",
  );
  const [tagsInput, setTagsInput] = useState(normalizeTagsToInput(initialValue?.tags ?? []));
  const [contentLatex, setContentLatex] = useState(initialValue?.contentLatex ?? "");
  const [explanationLatex, setExplanationLatex] = useState(initialValue?.explanationLatex ?? "");
  const [authoringNotes, setAuthoringNotes] = useState(initialValue?.authoringNotes ?? "");
  const [imagePath, setImagePath] = useState(initialValue?.imagePath ?? null);
  const [imageUrl, setImageUrl] = useState(initialValue?.imageUrl ?? null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialValue?.updatedAt ?? "");

  const [mcqOptions, setMcqOptions] = useState<ProblemOption[]>(
    optionListForType("mcq", initialValue?.type === "mcq" ? initialValue.options : null),
  );
  const [tfOptions, setTfOptions] = useState<ProblemOption[]>(
    optionListForType("tf", initialValue?.type === "tf" ? initialValue.options : null),
  );

  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>(
    initialValue?.type === "mcq" && "correctOptionIds" in initialValue.answerKey
      ? initialValue.answerKey.correctOptionIds
      : [],
  );
  const [trueFalseAcceptedAnswer, setTrueFalseAcceptedAnswer] = useState<"true" | "false">(
    initialValue?.type === "tf" && "acceptedAnswer" in initialValue.answerKey
      ? initialValue.answerKey.acceptedAnswer
      : "true",
  );
  const [acceptedAnswersInput, setAcceptedAnswersInput] = useState(
    initialValue?.type === "numeric" && "acceptedAnswers" in initialValue.answerKey
      ? initialValue.answerKey.acceptedAnswers.join(" | ")
      : initialValue?.type === "identification" && "acceptedAnswers" in initialValue.answerKey
        ? initialValue.answerKey.acceptedAnswers.join(" | ")
        : "",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [status, setStatus] = useState<FormStatus>({
    type: "pending",
    message: null,
  });

  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const acceptedAnswersPreview = useMemo(() => {
    if (type !== "numeric" && type !== "identification") {
      return [] as string[];
    }

    const preview = validateCanonicalAcceptedAnswers(acceptedAnswersInput);
    if (!preview.ok || !preview.value) {
      return [] as string[];
    }

    return preview.value;
  }, [acceptedAnswersInput, type]);

  const canSubmit = editable && !isSaving && !isDeleting && !isUploadingAsset;

  const submitLabel = isEditMode ? "Save problem" : "Create problem";

  const handleTypeChange = (nextType: ProblemType) => {
    setType(nextType);

    if (nextType === "mcq") {
      if (mcqOptions.length < 2) {
        setMcqOptions(createDefaultMcqOptions());
      }
      return;
    }

    if (nextType === "tf" && tfOptions.length < 2) {
      setTfOptions(DEFAULT_TF_OPTIONS);
    }
  };

  const addMcqOption = () => {
    const nextIndex = mcqOptions.length;
    setMcqOptions((current) => [
      ...current,
      { id: createOptionId(nextIndex), label: `Option ${String.fromCharCode(65 + nextIndex)}` },
    ]);
  };

  const removeMcqOption = (optionId: string) => {
    setMcqOptions((current) => current.filter((option) => option.id !== optionId));
    setCorrectOptionIds((current) => current.filter((id) => id !== optionId));
  };

  const updateMcqOption = (optionId: string, key: "id" | "label", nextValue: string) => {
    setMcqOptions((current) =>
      current.map((option) =>
        option.id === optionId ? { ...option, [key]: nextValue } : option,
      ),
    );

    if (key === "id") {
      setCorrectOptionIds((current) =>
        current.map((id) => (id === optionId ? nextValue : id)),
      );
    }
  };

  const toggleCorrectOption = (optionId: string, checked: boolean) => {
    setCorrectOptionIds((current) => {
      if (checked) {
        if (current.includes(optionId)) {
          return current;
        }

        return [...current, optionId];
      }

      return current.filter((id) => id !== optionId);
    });
  };

  const updateTfOptionLabel = (optionId: string, label: string) => {
    setTfOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, label } : option)),
    );
  };

  const buildProblemDraft = (): ProblemWriteInput => {
    const answerKey =
      type === "mcq"
        ? { correctOptionIds }
        : type === "tf"
          ? { acceptedAnswer: trueFalseAcceptedAnswer }
          : acceptedAnswersInput;

    const options = type === "mcq" ? mcqOptions : type === "tf" ? tfOptions : null;

    return {
      type,
      difficulty,
      tags: tagsInput,
      contentLatex,
      explanationLatex,
      authoringNotes,
      imagePath,
      options,
      answerKey,
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const validation = validateProblemDraft(buildProblemDraft());
    if (!validation.ok || !validation.value) {
      setStatus({
        type: "error",
        message: validation.errors[0]?.reason ?? "Please correct the problem fields before saving.",
      });
      return;
    }

    setIsSaving(true);
    setStatus({
      type: "pending",
      message: isEditMode ? "Saving problem..." : "Creating problem...",
    });

    try {
      const endpoint = isEditMode
        ? `/api/organizer/problem-banks/${bankId}/problems/${initialValue?.id}`
        : `/api/organizer/problem-banks/${bankId}/problems`;

      const response = await fetch(endpoint, {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...validation.value,
          expectedUpdatedAt: isEditMode ? expectedUpdatedAt : undefined,
        } satisfies ValidatedProblemWriteInput & { expectedUpdatedAt?: string }),
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: toPayloadErrorMessage(payload),
        });
        return;
      }

      const problem =
        typeof payload?.problem === "object" && payload.problem !== null
          ? (payload.problem as Record<string, unknown>)
          : null;

      const nextUpdatedAt =
        typeof problem?.updatedAt === "string"
          ? problem.updatedAt
          : typeof problem?.updated_at === "string"
            ? problem.updated_at
            : null;

      if (nextUpdatedAt) {
        setExpectedUpdatedAt(nextUpdatedAt);
      }

      setStatus({
        type: "success",
        message: isEditMode ? "Problem saved." : "Problem created.",
      });

      if (!isEditMode && typeof problem?.id === "string") {
        router.push(`${backHref}/problem/${problem.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setStatus({
        type: "error",
        message: "Unable to save problem right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!isEditMode || !initialValue?.id || !canSubmit) {
      return;
    }

    if (!window.confirm("Soft-delete this problem?")) {
      return;
    }

    setIsDeleting(true);
    setStatus({
      type: "pending",
      message: "Deleting problem...",
    });

    try {
      const response = await fetch(
        `/api/organizer/problem-banks/${bankId}/problems/${initialValue.id}`,
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ expectedUpdatedAt }),
        },
      );

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: toPayloadErrorMessage(payload),
        });
        return;
      }

      setStatus({
        type: "success",
        message: "Problem deleted.",
      });
      router.push(backHref);
      router.refresh();
    } catch {
      setStatus({
        type: "error",
        message: "Unable to delete this problem right now.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadImage = async (file: File | null) => {
    if (!file || !editable || isUploadingAsset) {
      return;
    }

    setIsUploadingAsset(true);
    setStatus({
      type: "pending",
      message: "Uploading image...",
    });

    try {
      const body = new FormData();
      body.set("bankId", bankId);
      body.set("file", file);

      const response = await fetch("/api/organizer/problem-banks/assets", {
        method: "POST",
        body,
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: toPayloadErrorMessage(payload),
        });
        return;
      }

      const nextImagePath =
        typeof payload?.imagePath === "string" ? payload.imagePath : null;
      const nextImageUrl = typeof payload?.signedUrl === "string" ? payload.signedUrl : null;

      if (!nextImagePath) {
        setStatus({
          type: "error",
          message: "Upload succeeded but image path was missing.",
        });
        return;
      }

      if (imagePath && imagePath !== nextImagePath) {
        await fetch("/api/organizer/problem-banks/assets", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imagePath, bankId }),
        });
      }

      setImagePath(nextImagePath);
      setImageUrl(nextImageUrl);
      setStatus({
        type: "success",
        message: "Image uploaded.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Unable to upload image right now.",
      });
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!imagePath || !editable || isUploadingAsset) {
      return;
    }

    setIsUploadingAsset(true);
    setStatus({
      type: "pending",
      message: "Removing image...",
    });

    try {
      const response = await fetch("/api/organizer/problem-banks/assets", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ imagePath, bankId }),
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: toPayloadErrorMessage(payload),
        });
        return;
      }

      setImagePath(null);
      setImageUrl(null);
      setStatus({
        type: "success",
        message: "Image removed.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Unable to remove image right now.",
      });
    } finally {
      setIsUploadingAsset(false);
    }
  };

  return (
    <div className="space-y-4">
      <ProgressLink href={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to problem bank
      </ProgressLink>

      <Card className="border-border/60 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{isEditMode ? "Edit Problem" : "Create Problem"}</CardTitle>
          <CardDescription>
            Compose canonical LaTeX content, validate answer structure, and maintain reusable metadata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit} aria-busy={!canSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="problem-type">Problem type</Label>
                <select
                  id="problem-type"
                  value={type}
                  onChange={(event) => handleTypeChange(event.target.value as ProblemType)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!editable}
                >
                  {PROBLEM_TYPES.map((problemType) => (
                    <option key={problemType} value={problemType}>
                      {problemType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="problem-difficulty">Difficulty</Label>
                <select
                  id="problem-difficulty"
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(event.target.value as ProblemDifficulty)
                  }
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={!editable}
                >
                  {PROBLEM_DIFFICULTIES.map((problemDifficulty) => (
                    <option key={problemDifficulty} value={problemDifficulty}>
                      {problemDifficulty}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="problem-tags">Tags (pipe delimited)</Label>
              <Input
                id="problem-tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="algebra | grade-8 | polynomial"
                disabled={!editable}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MathliveField
                id="problem-content"
                label="Problem content (LaTeX)"
                value={contentLatex}
                onChange={setContentLatex}
                placeholder="Enter problem statement"
                disabled={!editable}
                required
              />
              <KatexPreview latex={contentLatex} label="Prompt preview" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MathliveField
                id="problem-explanation"
                label="Explanation (LaTeX)"
                value={explanationLatex}
                onChange={setExplanationLatex}
                placeholder="Explain the expected solving path"
                disabled={!editable}
              />
              <KatexPreview latex={explanationLatex} label="Explanation preview" />
            </div>

            {type === "mcq" ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">MCQ options</p>
                  <Button type="button" size="sm" variant="outline" onClick={addMcqOption} disabled={!editable}>
                    <Plus className="size-4" />
                    Add option
                  </Button>
                </div>
                {mcqOptions.map((option) => (
                  <div key={option.id} className="grid gap-3 rounded-lg border border-border/50 p-3 md:grid-cols-[minmax(0,0.25fr)_minmax(0,1fr)_auto_auto] md:items-center">
                    <Input
                      value={option.id}
                      onChange={(event) => updateMcqOption(option.id, "id", event.target.value)}
                      aria-label={`Option id ${option.id}`}
                      disabled={!editable}
                    />
                    <Input
                      value={option.label}
                      onChange={(event) => updateMcqOption(option.id, "label", event.target.value)}
                      aria-label={`Option label ${option.id}`}
                      disabled={!editable}
                    />
                    <label className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={correctOptionIds.includes(option.id)}
                        onCheckedChange={(checked) =>
                          toggleCorrectOption(option.id, checked === true)
                        }
                        disabled={!editable}
                      />
                      Correct
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMcqOption(option.id)}
                      disabled={!editable || mcqOptions.length <= 2}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {type === "tf" ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <p className="text-sm font-semibold">True/False options</p>
                {tfOptions.map((option) => (
                  <div key={option.id} className="grid gap-2 md:grid-cols-[minmax(0,0.25fr)_minmax(0,1fr)]">
                    <Input value={option.id} disabled readOnly />
                    <Input
                      value={option.label}
                      onChange={(event) => updateTfOptionLabel(option.id, event.target.value)}
                      disabled={!editable}
                    />
                  </div>
                ))}
                <div className="grid gap-2">
                  <Label htmlFor="tf-answer">Accepted answer</Label>
                  <select
                    id="tf-answer"
                    value={trueFalseAcceptedAnswer}
                    onChange={(event) =>
                      setTrueFalseAcceptedAnswer(event.target.value as "true" | "false")
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={!editable}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              </div>
            ) : null}

            {type === "numeric" || type === "identification" ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <Label htmlFor="accepted-answers">Accepted answers (pipe delimited)</Label>
                <Input
                  id="accepted-answers"
                  value={acceptedAnswersInput}
                  onChange={(event) => setAcceptedAnswersInput(event.target.value)}
                  placeholder="x^2 | x^{2}"
                  disabled={!editable}
                />
                <p className="text-xs text-muted-foreground">
                  Answers are normalized and deduplicated before save.
                </p>
                {acceptedAnswersPreview.length > 0 ? (
                  <div className="grid gap-2">
                    {acceptedAnswersPreview.map((answer) => (
                      <KatexPreview
                        key={answer}
                        latex={answer}
                        label="Accepted answer preview"
                        displayMode={false}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-xl border border-border/60 p-4">
              <div className="grid gap-2">
                <Label htmlFor="authoring-notes">Authoring notes</Label>
                <textarea
                  id="authoring-notes"
                  value={authoringNotes}
                  onChange={(event) => setAuthoringNotes(event.target.value)}
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={!editable}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="problem-image">Problem image</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="problem-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      void handleUploadImage(nextFile);
                      event.currentTarget.value = "";
                    }}
                    disabled={!editable || isUploadingAsset}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveImage}
                    disabled={!editable || !imagePath || isUploadingAsset}
                  >
                    <ImageMinus className="size-4" />
                    Remove image
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Allowed MIME types: image/jpeg, image/png, image/webp. Max file size is 5MB.
                </p>
                {imagePath ? (
                  <p className="text-xs text-muted-foreground">Current image path: {imagePath}</p>
                ) : null}
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Problem asset preview"
                    className="max-h-48 rounded-md border border-border/70 object-contain"
                  />
                ) : null}
              </div>
            </div>

            <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
              <FormStatusMessage
                status={status.type}
                message={status.message}
                icon={
                  status.type === "error"
                    ? AlertCircle
                    : status.type === "success"
                      ? CheckCircle2
                      : undefined
                }
              />
            </div>

            {!editable ? (
              <FormStatusMessage
                status="error"
                message="This problem is read-only in the current workspace context."
                icon={AlertCircle}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleSoftDelete}
                  pending={isDeleting}
                  pendingText="Deleting..."
                  disabled={!editable || isSaving}
                >
                  <Trash2 className="size-4" />
                  Soft delete
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Soft delete is available after creation.</span>
              )}

              <Button type="submit" pending={isSaving} pendingText="Saving..." disabled={!editable || isDeleting}>
                {isUploadingAsset ? <Upload className="size-4" /> : null}
                {submitLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
