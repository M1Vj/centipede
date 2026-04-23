"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Save, X, Info } from "lucide-react";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import {
  useProblemFormDraft,
  type ProblemFormDraftState,
} from "@/hooks/use-problem-form-draft";
import { ProblemBasicInfo } from "@/components/problem-bank/problem-basic-info";
import { ProblemContentEditor } from "@/components/problem-bank/problem-content-editor";
import { ProblemOptionsEditor } from "@/components/problem-bank/problem-options-editor";
import { ProblemNotesImage } from "@/components/problem-bank/problem-notes-image";
import {
  validateProblemWriteInput,
  type ProblemWriteInput,
  type ValidatedProblemWriteInput,
} from "@/lib/problem-bank/api-helpers";
import { preprocessImageForUpload } from "@/lib/problem-bank/image-preprocessing";
import {
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

  return (
    <div className="flex flex-col gap-6 w-full max-w-[850px] mx-auto font-['Poppins',sans-serif]">
      {draftBannerVisible ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#f49700]/20 bg-[#f49700]/10 px-6 py-4 text-[14px] text-[#1a1e2e] shadow-sm font-medium">
          <Info className="w-5 h-5 shrink-0 text-[#f49700]" />
          <span className="flex-1">A previously saved draft has been restored.</span>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-bold text-[#1a1e2e] hover:bg-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
            Discard draft
          </button>
        </div>
      ) : null}

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} aria-busy={!canSubmit}>
        <ProblemBasicInfo
          type={type}
          difficulty={difficulty}
          tagsInput={tagsInput}
          onTypeChange={handleTypeChange}
          onDifficultyChange={setDifficulty}
          onTagsChange={setTagsInput}
        />

        <ProblemContentEditor
          contentLatex={contentLatex}
          explanationLatex={explanationLatex}
          onContentChange={setContentLatex}
          onExplanationChange={setExplanationLatex}
        />

        <ProblemOptionsEditor
          type={type}
          mcqOptions={mcqOptions}
          correctOptionIds={correctOptionIds}
          onAddMcqOption={addMcqOption}
          onRemoveMcqOption={removeMcqOption}
          onUpdateMcqOption={updateMcqOption}
          onToggleCorrectMcqOption={toggleCorrectOption}
          tfOptions={tfOptions}
          tfAcceptedAnswer={trueFalseAcceptedAnswer}
          onUpdateTfOptionLabel={updateTfOptionLabel}
          onUpdateTfAcceptedAnswer={setTrueFalseAcceptedAnswer}
          acceptedAnswerEntries={acceptedAnswerEntries}
          onAddAcceptedAnswerEntry={addAcceptedAnswerEntry}
          onRemoveAcceptedAnswerEntry={removeAcceptedAnswerEntry}
          onUpdateAcceptedAnswerEntry={updateAcceptedAnswerEntry}
        />

        <ProblemNotesImage
          authoringNotes={authoringNotes}
          onAuthoringNotesChange={setAuthoringNotes}
          imageUrl={imageUrl}
          onUploadImage={handleUploadImage}
          isUploadingAsset={isUploadingAsset}
        />

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={status.type}
            message={status.message}
          />
        </div>

        {/* Action Bar (Sticky-ish bottom container) */}
        <div className="mt-2 flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 md:px-6 shadow-sm w-full">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="text-slate-500 hover:text-[#10182b] font-bold text-[14px] transition-colors px-4 py-2"
            >
              Cancel
            </button>
            {isEditMode && (
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={!editable || isDeleting || isSaving}
                className="text-red-500 hover:text-red-600 font-bold text-[14px] transition-colors px-4 py-2 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              type="button"
              className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-6 py-3 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              type="submit"
              disabled={!editable || isDeleting || isSaving}
              className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-6 py-3 rounded-xl font-bold text-[14px] transition-all shadow-sm hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> {isSaving ? "Saving..." : isEditMode ? "Save problem" : "Add problem"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
