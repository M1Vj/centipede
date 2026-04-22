"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, RefreshCcw, Upload } from "lucide-react";
import { FormStatusMessage } from "@/components/ui/feedback-states";
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
  const router = useRouter();
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
      router.refresh();
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
    <div className="flex flex-col gap-6">

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/organizer/problem-banks/import"
            download
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#10182b] font-bold text-[14px] hover:bg-slate-100 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Download CSV Template
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="import-token" className="text-[#10182b] font-bold text-[14px]">
            Idempotency Token
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="import-token"
              value={idempotencyToken}
              onChange={(event) => setIdempotencyToken(event.target.value)}
              className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-5 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => setIdempotencyToken(nextToken())}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[#10182b] font-bold text-[14px] hover:bg-slate-100 transition-colors shrink-0"
            >
              <RefreshCcw className="w-4 h-4" />
              New Token
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="import-csv" className="text-[#10182b] font-bold text-[14px]">
            Import CSV File
          </label>
          <input
            id="import-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
            className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-5 py-3 text-[14px] file:mr-4 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:bg-[#f49700] file:text-[#10182b] file:font-bold file:text-[13px] hover:file:bg-[#e08900] transition-colors"
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
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm space-y-1">
            <p className="font-bold text-[#10182b] mb-2">Import Summary</p>
            <p className="text-slate-500">Total rows: <span className="font-semibold text-[#10182b]">{summary.totalRows}</span></p>
            <p className="text-slate-500">Inserted: <span className="font-semibold text-[#10182b]">{summary.insertedRows}</span></p>
            <p className="text-slate-500">Failed: <span className="font-semibold text-red-500">{summary.failedRows}</span></p>
            {summary.groupedRowErrors.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="font-bold text-[#10182b] text-[13px]">Grouped Row Errors</p>
                <ul className="space-y-1 text-xs text-slate-500 list-disc pl-4">
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-8 py-4 rounded-xl font-bold text-[15px] transition-all hover:shadow-lg hover:shadow-[#f49700]/30 disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {isSubmitting ? "Importing..." : "Import CSV"}
          </button>
        </div>

      </form>
    </div>
  );
}
