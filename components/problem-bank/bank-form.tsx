"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { validateBankInput } from "@/lib/problem-bank/validation";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";

interface BankFormInitialValue {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

interface BankFormProps {
  mode: "create" | "edit";
  initialValue?: BankFormInitialValue;
  successRedirectHref?: string;
}

type FormStatus = {
  type: "pending" | "error" | "success";
  message: string | null;
};

function deriveErrorMessage(payload: Record<string, unknown> | null): string {
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

export function BankForm({
  mode,
  initialValue,
  successRedirectHref = "/organizer/problem-bank",
}: BankFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialValue?.name ?? "");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialValue?.updatedAt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<FormStatus>({
    type: "pending",
    message: null,
  });

  useEffect(() => {
    if (mode === "edit" && initialValue?.updatedAt) {
      setExpectedUpdatedAt(initialValue.updatedAt);
    }
  }, [initialValue?.updatedAt, mode]);

  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const descriptionWordCount = useMemo(() => {
    if (!description.trim()) {
      return 0;
    }

    return description.trim().split(/\s+/).length;
  }, [description]);

  const submitLabel = mode === "create" ? "Create bank" : "Save bank";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const editingBankId = initialValue?.id;

    if (isSaving || (mode === "edit" && !editingBankId)) {
      return;
    }

    const validation = validateBankInput({ name, description });
    if (!validation.ok || !validation.value) {
      setStatus({
        type: "error",
        message:
          validation.errors[0]?.reason ?? "Please provide a valid bank name and description.",
      });
      return;
    }

    setIsSaving(true);
    setStatus({
      type: "pending",
      message: mode === "create" ? "Creating bank..." : "Saving bank...",
    });

    try {
      const endpoint =
        mode === "create"
          ? "/api/organizer/problem-banks"
          : `/api/organizer/problem-banks/${editingBankId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: validation.value.name,
          description: validation.value.description,
          expectedUpdatedAt: mode === "edit" ? expectedUpdatedAt : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: deriveErrorMessage(payload),
        });
        return;
      }

      const bank =
        typeof payload?.bank === "object" && payload.bank !== null
          ? (payload.bank as Record<string, unknown>)
          : null;

      if (mode === "create") {
        const createdBankId = typeof bank?.id === "string" ? bank.id : null;
        setStatus({
          type: "success",
          message: "Bank created successfully.",
        });

        if (createdBankId) {
          router.push(`/organizer/problem-bank/${createdBankId}`);
          router.refresh();
          return;
        }

        router.push(successRedirectHref);
        router.refresh();
        return;
      }

      const nextUpdatedAt =
        typeof bank?.updatedAt === "string"
          ? bank.updatedAt
          : typeof bank?.updated_at === "string"
            ? bank.updated_at
            : null;

      if (nextUpdatedAt) {
        setExpectedUpdatedAt(nextUpdatedAt);
      }

      setStatus({
        type: "success",
        message: "Bank saved successfully.",
      });
      router.refresh();
    } catch {
      setStatus({
        type: "error",
        message: "Unable to save bank right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    const editingBankId = initialValue?.id;
    if (!editingBankId || isDeleting || isSaving) {
      return;
    }

    if (!window.confirm("Soft-delete this bank? You can no longer use it in authoring flows.")) {
      return;
    }

    setIsDeleting(true);
    setStatus({
      type: "pending",
      message: "Deleting bank...",
    });

    try {
      const response = await fetch(`/api/organizer/problem-banks/${editingBankId}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedUpdatedAt }),
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: deriveErrorMessage(payload),
        });
        return;
      }

      setStatus({
        type: "success",
        message: "Bank deleted.",
      });
      router.push(successRedirectHref);
      router.refresh();
    } catch {
      setStatus({
        type: "error",
        message: "Unable to delete bank right now.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} aria-busy={isSaving || isDeleting}>

      <div className="flex flex-col gap-2">
        <label htmlFor="bank-name" className="text-[#10182b] font-bold text-[14px]">
          Problem Bank Name
        </label>
        <input
          id="bank-name"
          type="text"
          placeholder="e.g. Advanced Calculus Weekly"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all placeholder:text-slate-400 font-medium"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="bank-description" className="text-[#10182b] font-bold text-[14px]">
          Description <span className="text-slate-400 font-medium">(optional, max 200 words)</span>
        </label>
        <textarea
          id="bank-description"
          placeholder="What topics are covered in this problem bank?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-5 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all placeholder:text-slate-400 font-medium resize-none"
        />
        <p className="text-xs text-slate-400">Current word count: {descriptionWordCount}</p>
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

      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
        {mode === "edit" ? (
          <button
            type="button"
            onClick={handleSoftDelete}
            disabled={isDeleting || isSaving}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-[14px] hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Soft delete"}
          </button>
        ) : (
          <span className="text-xs text-slate-400">Soft delete is available after creation.</span>
        )}

        <button
          type="submit"
          disabled={isSaving || isDeleting}
          className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-8 py-4 rounded-xl font-bold text-[15px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2 disabled:opacity-60"
        >
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>

    </form>
  );
}
