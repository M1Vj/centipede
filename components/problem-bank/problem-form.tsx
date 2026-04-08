"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImageMinus,
  Info,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { MathliveField } from "@/components/math-editor/mathlive-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressLink } from "@/components/ui/progress-link";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import {
  useProblemFormDraft,
  type ProblemFormDraftState,
} from "@/hooks/use-problem-form-draft";
import {
  validateProblemWriteInput,
  type ProblemWriteInput,
  type ValidatedProblemWriteInput,
} from "@/lib/problem-bank/api-helpers";
import { preprocessImageForUpload } from "@/lib/problem-bank/image-preprocessing";
import {
  PROBLEM_DIFFICULTIES,
  PROBLEM_TYPES,
  type ProblemDifficulty,
  type ProblemOption,
  type ProblemType,
} from "@/lib/problem-bank/types";

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

interface FormOption extends ProblemOption {
  _reactKey: number;
}

const DEFAULT_TF_OPTIONS: ProblemOption[] = [
  { id: "true", label: "True" },
  { id: "false", label: "False" },
];

function createOptionId(index: number): string {
  return `opt_${index + 1}`;
}

let nextReactKey = 1;

function assignReactKey(option: ProblemOption): FormOption {
  return { ...option, _reactKey: nextReactKey++ };
}

function assignReactKeys(options: ProblemOption[]): FormOption[] {
  return options.map(assignReactKey);
}

function stripReactKeys(options: FormOption[]): ProblemOption[] {
  return options.map((option) => ({ id: option.id, label: option.label }));
}

function createDefaultMcqOptions(): FormOption[] {
  return [
    assignReactKey({ id: createOptionId(0), label: "Option A" }),
    assignReactKey({ id: createOptionId(1), label: "Option B" }),
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

function unwrapTopLevelMathliveText(value: string): string {
  const trimmed = value.trim();
  const textPrefix = "\\text{";

  if (!trimmed.startsWith(textPrefix) || !trimmed.endsWith("}")) {
    return trimmed;
  }

  let depth = 0;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    const previousCharacter = index > 0 ? trimmed[index - 1] : "";

    if (character === "{" && previousCharacter !== "\\") {
      depth += 1;
      continue;
    }

    if (character === "}" && previousCharacter !== "\\") {
      depth -= 1;

      if (depth < 0) {
        return trimmed;
      }

      if (depth === 0 && index < trimmed.length - 1) {
        return trimmed;
      }
    }
  }

  if (depth !== 0) {
    return trimmed;
  }

  return trimmed.slice(textPrefix.length, -1).trim();
}

function unwrapTopLevelMathliveDelimitedText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("$") || !trimmed.endsWith("$")) {
    return trimmed;
  }

  const hasDoubleDollarDelimiters = trimmed.startsWith("$$") && trimmed.endsWith("$$");
  const delimiterSize = hasDoubleDollarDelimiters ? 2 : 1;
  const innerValue = trimmed.slice(delimiterSize, -delimiterSize).trim();

  if (!innerValue || innerValue.includes("$")) {
    return trimmed;
  }

  const unwrappedInnerValue = unwrapTopLevelMathliveText(innerValue);
  if (unwrappedInnerValue === innerValue) {
    return trimmed;
  }

  return unwrappedInnerValue;
}

function normalizeLegacyMathliveValue(value: string): string {
  let normalizedValue = value.trim();

  while (true) {
    const unwrappedDelimitedValue = unwrapTopLevelMathliveDelimitedText(normalizedValue);
    if (unwrappedDelimitedValue !== normalizedValue) {
      normalizedValue = unwrappedDelimitedValue;
      continue;
    }

    const unwrappedValue = unwrapTopLevelMathliveText(normalizedValue);
    if (unwrappedValue === normalizedValue) {
      return normalizedValue;
    }

    normalizedValue = unwrappedValue;
  }
}

function normalizeLegacyOptionList(options: ProblemOption[] | null): ProblemOption[] | null {
  if (!options) {
    return null;
  }

  return options.map((option) => ({
    ...option,
    label: normalizeLegacyMathliveValue(option.label),
  }));
}

function optionListForType(type: ProblemType, options: ProblemOption[] | null): FormOption[] {
  if (type === "tf") {
    if (!options || options.length < 2) {
      return assignReactKeys(DEFAULT_TF_OPTIONS);
    }

    return assignReactKeys(options);
  }

  if (type === "mcq") {
    if (!options || options.length < 2) {
      return createDefaultMcqOptions();
    }

    return assignReactKeys(options);
  }

  return [];
}

function toAcceptedAnswerEntries(initialValue: ProblemFormInitialValue | null | undefined): string[] {
  if (!initialValue) {
    return [""];
  }

  if (
    (initialValue.type === "numeric" || initialValue.type === "identification") &&
    "acceptedAnswers" in initialValue.answerKey
  ) {
    const entries = initialValue.answerKey.acceptedAnswers.filter(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );

    return entries.length > 0 ? entries.map((entry) => normalizeLegacyMathliveValue(entry)) : [""];
  }

  return [""];
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
  const isMountedRef = useRef(true);
  const isEditMode = Boolean(initialValue?.id);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [type, setType] = useState<ProblemType>(initialValue?.type ?? "mcq");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>(
    initialValue?.difficulty ?? "average",
  );
  const [tagsInput, setTagsInput] = useState(normalizeTagsToInput(initialValue?.tags ?? []));
  const [contentLatex, setContentLatex] = useState(
    normalizeLegacyMathliveValue(initialValue?.contentLatex ?? ""),
  );
  const [explanationLatex, setExplanationLatex] = useState(
    normalizeLegacyMathliveValue(initialValue?.explanationLatex ?? ""),
  );
  const [authoringNotes, setAuthoringNotes] = useState(initialValue?.authoringNotes ?? "");
  const [imagePath, setImagePath] = useState(initialValue?.imagePath ?? null);
  const [imageUrl, setImageUrl] = useState(initialValue?.imageUrl ?? null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialValue?.updatedAt ?? "");

  const [mcqOptions, setMcqOptions] = useState<FormOption[]>(
    optionListForType(
      "mcq",
      initialValue?.type === "mcq" ? normalizeLegacyOptionList(initialValue.options) : null,
    ),
  );
  const [tfOptions, setTfOptions] = useState<FormOption[]>(
    optionListForType(
      "tf",
      initialValue?.type === "tf" ? normalizeLegacyOptionList(initialValue.options) : null,
    ),
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
  const [acceptedAnswerEntries, setAcceptedAnswerEntries] = useState<string[]>(
    toAcceptedAnswerEntries(initialValue),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [status, setStatus] = useState<FormStatus>({
    type: "pending",
    message: null,
  });
  const [draftBannerVisible, setDraftBannerVisible] = useState(false);

  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const { loadDraft, clearDraft, scheduleSave } = useProblemFormDraft({
    bankId,
    problemId: initialValue?.id ?? null,
  });

  const collectDraftState = useCallback((): ProblemFormDraftState => ({
    type,
    difficulty,
    tagsInput,
    contentLatex,
    explanationLatex,
    authoringNotes,
    imagePath,
    imageUrl,
    mcqOptions: stripReactKeys(mcqOptions),
    tfOptions: stripReactKeys(tfOptions),
    correctOptionIds,
    trueFalseAcceptedAnswer,
    acceptedAnswerEntries,
  }), [
    type, difficulty, tagsInput, contentLatex, explanationLatex,
    authoringNotes, imagePath, imageUrl, mcqOptions, tfOptions,
    correctOptionIds, trueFalseAcceptedAnswer, acceptedAnswerEntries,
  ]);

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      return;
    }

    setType(draft.type);
    setDifficulty(draft.difficulty);
    setTagsInput(draft.tagsInput);
    setContentLatex(draft.contentLatex);
    setExplanationLatex(draft.explanationLatex);
    setAuthoringNotes(draft.authoringNotes);
    if (draft.imagePath !== undefined) setImagePath(draft.imagePath);
    if (draft.imageUrl !== undefined) setImageUrl(draft.imageUrl);
    setMcqOptions(assignReactKeys(draft.mcqOptions));
    setTfOptions(assignReactKeys(draft.tfOptions));
    setCorrectOptionIds(draft.correctOptionIds);
    setTrueFalseAcceptedAnswer(draft.trueFalseAcceptedAnswer);
    setAcceptedAnswerEntries(draft.acceptedAnswerEntries);
    setDraftBannerVisible(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDraftClearedRef = useRef(false);

  useEffect(() => {
    if (!isDraftClearedRef.current) {
      scheduleSave(collectDraftState());
    }
  }, [collectDraftState, scheduleSave]);

  const handleDiscardDraft = () => {
    isDraftClearedRef.current = true;
    clearDraft();
    setDraftBannerVisible(false);
    window.location.reload();
  };

  const acceptedAnswersInput = useMemo(
    () =>
      acceptedAnswerEntries
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .join(" | "),
    [acceptedAnswerEntries],
  );

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
      setTfOptions(assignReactKeys(DEFAULT_TF_OPTIONS));
    }

    if ((nextType === "numeric" || nextType === "identification") && acceptedAnswerEntries.length === 0) {
      setAcceptedAnswerEntries([""]);
    }
  };

  const updateAcceptedAnswerEntry = (index: number, nextValue: string) => {
    setAcceptedAnswerEntries((current) =>
      current.map((entry, entryIndex) => (entryIndex === index ? nextValue : entry)),
    );
  };

  const addAcceptedAnswerEntry = () => {
    setAcceptedAnswerEntries((current) => [...current, ""]);
  };

  const removeAcceptedAnswerEntry = (index: number) => {
    setAcceptedAnswerEntries((current) => {
      if (current.length <= 1) {
        return [""];
      }

      const nextEntries = current.filter((_, entryIndex) => entryIndex !== index);
      return nextEntries.length > 0 ? nextEntries : [""];
    });
  };

  const addMcqOption = () => {
    const nextIndex = mcqOptions.length;
    setMcqOptions((current) => [
      ...current,
      assignReactKey({ id: createOptionId(nextIndex), label: `Option ${String.fromCharCode(65 + nextIndex)}` }),
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

    const options = type === "mcq" ? stripReactKeys(mcqOptions) : type === "tf" ? stripReactKeys(tfOptions) : null;

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

      if (!isMountedRef.current) {
        return;
      }

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

      isDraftClearedRef.current = true;
      clearDraft();
      setDraftBannerVisible(false);
      router.push(backHref);
      router.refresh();

      if (!isEditMode) {
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setType("mcq");
          setDifficulty("average");
          setTagsInput("");
          setContentLatex("");
          setExplanationLatex("");
          setAuthoringNotes("");
          setImagePath(null);
          setImageUrl(null);
          setMcqOptions(createDefaultMcqOptions());
          setTfOptions(assignReactKeys(DEFAULT_TF_OPTIONS));
          setCorrectOptionIds([]);
          setTrueFalseAcceptedAnswer("true");
          setAcceptedAnswerEntries([""]);
          setStatus({ type: "pending", message: null });
        }, 800);
      }
    } catch {
      if (isMountedRef.current) {
        setStatus({
          type: "error",
          message: "Unable to save problem right now.",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
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

      if (!isMountedRef.current) {
        return;
      }

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
      isDraftClearedRef.current = true;
      clearDraft();
      setDraftBannerVisible(false);
      router.push(backHref);
      router.refresh();
    } catch {
      if (isMountedRef.current) {
        setStatus({
          type: "error",
          message: "Unable to delete this problem right now.",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
    }
  };

  const handleUploadImage = async (file: File | null) => {
    if (!file || !editable || isUploadingAsset) {
      return;
    }

    setIsUploadingAsset(true);
    setStatus({
      type: "pending",
      message: "Preparing image...",
    });

    try {
      let preprocessedFile: File;

      try {
        preprocessedFile = await preprocessImageForUpload(file);
      } catch (error) {
        if (isMountedRef.current) {
          setStatus({
            type: "error",
            message:
              error instanceof Error && error.message.trim().length > 0
                ? error.message
                : "Image conversion failed. Please upload a valid image file.",
          });
        }
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setStatus({
        type: "pending",
        message: "Uploading image...",
      });

      const body = new FormData();
      body.set("bankId", bankId);
      body.set("file", preprocessedFile);

      const response = await fetch("/api/organizer/problem-banks/assets", {
        method: "POST",
        body,
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!isMountedRef.current) {
        return;
      }

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

        if (!isMountedRef.current) {
          return;
        }
      }

      setImagePath(nextImagePath);
      setImageUrl(nextImageUrl);
      setStatus({
        type: "success",
        message: "Image uploaded.",
      });
    } catch {
      if (isMountedRef.current) {
        setStatus({
          type: "error",
          message: "Unable to upload image right now.",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploadingAsset(false);
      }
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

      if (!isMountedRef.current) {
        return;
      }

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
      if (isMountedRef.current) {
        setStatus({
          type: "error",
          message: "Unable to remove image right now.",
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploadingAsset(false);
      }
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
          {draftBannerVisible ? (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <Info className="size-4 shrink-0" />
              <span className="flex-1">A previously saved draft has been restored.</span>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                <X className="size-3" />
                Discard draft
              </button>
            </div>
          ) : null}
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

            <div className="grid grid-cols-1 gap-4">
              <MathliveField
                id="problem-content"
                label="Problem content (LaTeX)"
                value={contentLatex}
                onChange={setContentLatex}
                preferredInitialMode="text"
                placeholder="Enter problem statement"
                disabled={!editable}
                showPreviewToggle={true}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <MathliveField
                id="problem-explanation"
                label="Explanation (LaTeX)"
                value={explanationLatex}
                onChange={setExplanationLatex}
                preferredInitialMode="text"
                placeholder="Explain the expected solving path"
                disabled={!editable}
                showPreviewToggle={true}
              />
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
                  <div key={option._reactKey} className="grid gap-3 rounded-lg border border-border/50 p-3 md:grid-cols-[minmax(0,0.25fr)_minmax(0,1fr)_auto_auto] md:items-center">
                    <Input
                      value={option.id}
                      onChange={(event) => updateMcqOption(option.id, "id", event.target.value)}
                      aria-label={`Option id ${option.id}`}
                      disabled={!editable}
                    />
                    <MathliveField
                      id={`mcq-option-label-${option.id}`}
                      label={`Option label ${option.id} (MathLive / LaTeX)`}
                      value={option.label}
                      onChange={(nextValue) => updateMcqOption(option.id, "label", nextValue)}
                      disabled={!editable}
                      showPreviewToggle={true}
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
                  <div key={option._reactKey} className="grid gap-3 rounded-lg border border-border/50 p-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,0.25fr)_minmax(0,1fr)]">
                      <Input value={option.id} disabled readOnly aria-label={`TF option id ${option.id}`} />
                      <MathliveField
                        id={`tf-option-label-${option.id}`}
                        label={`TF option label ${option.id} (MathLive / LaTeX)`}
                        value={option.label}
                        onChange={(nextValue) => updateTfOptionLabel(option.id, nextValue)}
                        disabled={!editable}
                        showPreviewToggle={true}
                      />
                    </div>
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Accepted answers (MathLive / LaTeX)</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addAcceptedAnswerEntry}
                    disabled={!editable}
                  >
                    <Plus className="size-4" />
                    Add answer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the MathLive editor for each row. You can type LaTeX directly or use math mode with symbol shortcuts.
                </p>
                <div className="space-y-3">
                  {acceptedAnswerEntries.map((entry, index) => (
                    <div key={`accepted-answer-${index}`} className="space-y-2 rounded-lg border border-border/50 p-3">
                      <MathliveField
                        id={`accepted-answer-${index}`}
                        label={`Accepted answer ${index + 1} (MathLive / LaTeX)`}
                        value={entry}
                        onChange={(nextValue) => updateAcceptedAnswerEntry(index, nextValue)}
                        preferredInitialMode="math"
                        placeholder="x^2 or \\frac{1}{2}"
                        disabled={!editable}
                        showPreviewToggle={true}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAcceptedAnswerEntry(index)}
                          disabled={!editable || acceptedAnswerEntries.length <= 1}
                        >
                          <Trash2 className="size-4" />
                          Remove answer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Answers are normalized and deduplicated before save. Use multiple answer rows for equivalent forms.
                </p>
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
                    accept="image/*"
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
