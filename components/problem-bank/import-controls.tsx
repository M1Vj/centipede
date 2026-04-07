"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Download, RefreshCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";

type ImportSummary = {
  totalRows: number;
  insertedRows: number;
  failedRows: number;
  rowErrors: Array<{ rowNumber: number; reason: string }>;
  groupedRowErrors: Array<{
    signature: string;
    reason: string;
    count: number;
    sampleRows: number[];
  }>;
};

interface ImportControlsProps {
  bankId: string;
}

function nextToken() {
  return crypto.randomUUID();
}

function toErrorMessage(payload: Record<string, unknown> | null): string {
  if (!payload) {
    return "Import request failed.";
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return "Import request failed.";
}

function groupRowErrors(rowErrors: Array<{ rowNumber: number; reason: string }>) {
  const groups = new Map<
    string,
    {
      signature: string;
      reason: string;
      count: number;
      sampleRows: number[];
    }
  >();

  for (const rowError of rowErrors) {
    const normalizedReason = rowError.reason.trim() || "Unknown import error.";
    const signature = normalizedReason.toLowerCase();
    const existing = groups.get(signature);

    if (!existing) {
      groups.set(signature, {
        signature,
        reason: normalizedReason,
        count: 1,
        sampleRows: [rowError.rowNumber],
      });
      continue;
    }

    existing.count += 1;
    if (existing.sampleRows.length < 5) {
      existing.sampleRows.push(rowError.rowNumber);
    }
  }

  return Array.from(groups.values()).sort(
    (left, right) => right.count - left.count || left.reason.localeCompare(right.reason),
  );
}

export function ImportControls({ bankId }: ImportControlsProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [idempotencyToken, setIdempotencyToken] = useState(nextToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [status, setStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });

  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!csvFile) {
      setStatus({
        type: "error",
        message: "Choose a CSV file before importing.",
      });
      return;
    }

    setIsSubmitting(true);
    setSummary(null);
    setStatus({
      type: "pending",
      message: "Importing problems...",
    });

    try {
      const body = new FormData();
      body.set("bankId", bankId);
      body.set("idempotencyToken", idempotencyToken);
      body.set("file", csvFile);

      const response = await fetch("/api/organizer/problem-banks/import", {
        method: "POST",
        body,
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: toErrorMessage(payload),
        });
        return;
      }

      const summaryPayload =
        typeof payload?.summary === "object" && payload.summary !== null
          ? (payload.summary as Record<string, unknown>)
          : null;

      if (!summaryPayload) {
        setStatus({
          type: "error",
          message: "Import completed without summary payload.",
        });
        return;
      }

      const parsedRowErrors = Array.isArray(summaryPayload.rowErrors)
        ? (summaryPayload.rowErrors as Array<{ rowNumber: number; reason: string }>)
        : [];

      setSummary({
        totalRows: Number(summaryPayload.totalRows ?? 0),
        insertedRows: Number(summaryPayload.insertedRows ?? 0),
        failedRows: Number(summaryPayload.failedRows ?? 0),
        rowErrors: parsedRowErrors.slice(0, 50),
        groupedRowErrors: groupRowErrors(parsedRowErrors),
      });

      setStatus({
        type: "success",
        message:
          typeof payload?.message === "string"
            ? payload.message
            : "Import completed.",
      });
      setIdempotencyToken(nextToken());
    } catch {
      setStatus({
        type: "error",
        message: "Unable to import problems right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Bulk import</CardTitle>
        <CardDescription>
          Download the CSV template, populate rows, and import with deterministic summaries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" asChild>
              <a href="/api/organizer/problem-banks/import" download>
                <Download className="size-4" />
                Download CSV template
              </a>
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="import-token">Idempotency token</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="import-token"
                value={idempotencyToken}
                onChange={(event) => setIdempotencyToken(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => setIdempotencyToken(nextToken())}>
                <RefreshCcw className="size-4" />
                New token
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="import-csv">Import CSV file</Label>
            <Input
              id="import-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
            />
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

          {summary ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
              <p className="font-semibold text-foreground">Summary</p>
              <p className="mt-1 text-muted-foreground">Total rows: {summary.totalRows}</p>
              <p className="text-muted-foreground">Inserted rows: {summary.insertedRows}</p>
              <p className="text-muted-foreground">Failed rows: {summary.failedRows}</p>

              {summary.groupedRowErrors.length > 0 ? (
                <div className="mt-3 space-y-1">
                  <p className="font-semibold text-foreground">Grouped row errors</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {summary.groupedRowErrors.map((rowErrorGroup) => (
                      <li key={rowErrorGroup.signature}>
                        {rowErrorGroup.reason} ({rowErrorGroup.count})
                        {rowErrorGroup.sampleRows.length > 0
                          ? ` - rows ${rowErrorGroup.sampleRows.join(", ")}${
                              rowErrorGroup.count > rowErrorGroup.sampleRows.length ? ", ..." : ""
                            }`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" pending={isSubmitting} pendingText="Importing...">
              <Upload className="size-4" />
              Import CSV
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
