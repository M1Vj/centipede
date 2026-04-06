"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">
          {mode === "create" ? "Create Problem Bank" : "Edit Problem Bank"}
        </CardTitle>
        <CardDescription>
          Set a concise bank name and maintain a clear scope for reusable problem authoring.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSaving || isDeleting}>
          <div className="grid gap-2">
            <Label htmlFor="bank-name">Bank name</Label>
            <Input
              id="bank-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bank-description">Description (optional, max 200 words)</Label>
            <textarea
              id="bank-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Current word count: {descriptionWordCount}</p>
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleSoftDelete}
                pending={isDeleting}
                pendingText="Deleting bank..."
                disabled={isSaving}
              >
                <Trash2 className="size-4" />
                Soft delete
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Soft delete is available after creation.</span>
            )}

            <Button type="submit" pending={isSaving} pendingText="Saving..." disabled={isDeleting}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
