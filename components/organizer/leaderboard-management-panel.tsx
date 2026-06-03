"use client";

import { useMemo, useState } from "react";
import { LeaderboardStandings } from "@/components/leaderboard/leaderboard-standings";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import type { CompetitionFormat } from "@/lib/competition/types";
import type { AnswerKeyVisibility } from "@/lib/submission/types";
import type { CompetitionDispute } from "@/lib/disputes/api";
import type { ExportJob } from "@/lib/exports/api";
import type { LeaderboardEntry } from "@/lib/leaderboard/types";

type LeaderboardManagementPanelProps = {
  competitionId: string;
  leaderboardPublished: boolean;
  answerKeyVisibility: AnswerKeyVisibility;
  format: CompetitionFormat;
  entries: LeaderboardEntry[];
  disputes: CompetitionDispute[];
  exportJobs: ExportJob[];
};

type ActionState = {
  pending: boolean;
  error: string | null;
  success: string | null;
};

function initialActionState(): ActionState {
  return {
    pending: false,
    error: null,
    success: null,
  };
}

function statusBadgeClass(status: CompetitionDispute["status"]) {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-700";
    case "reviewing":
      return "bg-amber-100 text-amber-700";
    case "accepted":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    case "resolved":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function exportStatusBadgeClass(status: ExportJob["status"]) {
  switch (status) {
    case "queued":
      return "bg-slate-100 text-slate-700";
    case "processing":
      return "bg-blue-100 text-blue-700";
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "cancelled":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function isExportJobStatus(value: unknown): value is ExportJob["status"] {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  );
}

export function LeaderboardManagementPanel({
  competitionId,
  leaderboardPublished,
  answerKeyVisibility,
  format,
  entries,
  disputes,
  exportJobs,
}: LeaderboardManagementPanelProps) {
  const [published, setPublished] = useState(leaderboardPublished);
  const [releasedAnswerKey, setReleasedAnswerKey] = useState(answerKeyVisibility === "after_end");
  const [disputeRows, setDisputeRows] = useState(disputes);
  const [jobRows, setJobRows] = useState(exportJobs);
  const [publishAction, setPublishAction] = useState<ActionState>(() => initialActionState());
  const [answerKeyAction, setAnswerKeyAction] = useState<ActionState>(() => initialActionState());
  const [exportAction, setExportAction] = useState<ActionState>(() => initialActionState());
  const [disputeAction, setDisputeAction] = useState<ActionState>(() => initialActionState());
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  const nonTerminalDisputeIds = useMemo(
    () =>
      new Set(
        disputeRows
          .filter((dispute) => dispute.status === "open" || dispute.status === "reviewing")
          .map((dispute) => dispute.id),
      ),
    [disputeRows],
  );

  async function publishLeaderboard() {
    setPublishAction({ pending: true, error: null, success: null });
    try {
      const response = await fetch(
        `/api/organizer/competitions/${competitionId}/leaderboard/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": crypto.randomUUID(),
          },
          credentials: "same-origin",
          body: "{}",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; leaderboardPublished?: boolean; code?: string }
        | null;

      if (!response.ok) {
        setPublishAction({
          pending: false,
          error: payload?.message ?? "Unable to publish leaderboard.",
          success: null,
        });
        return;
      }

      setPublished(payload?.leaderboardPublished === true);
      setPublishAction({
        pending: false,
        error: null,
        success: "Leaderboard published.",
      });
    } catch (error) {
      setPublishAction({
        pending: false,
        error: error instanceof Error ? error.message : "Unable to publish leaderboard.",
        success: null,
      });
    }
  }

  async function releaseAnswerKey() {
    setAnswerKeyAction({ pending: true, error: null, success: null });
    try {
      const response = await fetch(
        `/api/organizer/competitions/${competitionId}/answer-key/release`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": crypto.randomUUID(),
          },
          credentials: "same-origin",
          body: "{}",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; notifiedCount?: number; notificationFailureCount?: number }
        | null;

      if (!response.ok) {
        setAnswerKeyAction({
          pending: false,
          error: payload?.message ?? "Unable to release answer key.",
          success: null,
        });
        return;
      }

      setReleasedAnswerKey(true);
      const notifiedCount = payload?.notifiedCount ?? 0;
      const notificationFailureCount = payload?.notificationFailureCount ?? 0;
      setAnswerKeyAction({
        pending: false,
        error: notificationFailureCount > 0
          ? `${notificationFailureCount} notification(s) could not be sent.`
          : null,
        success: `Answer key released. ${notifiedCount} mathlete(s) notified.`,
      });
    } catch (error) {
      setAnswerKeyAction({
        pending: false,
        error: error instanceof Error ? error.message : "Unable to release answer key.",
        success: null,
      });
    }
  }

  async function queueExport(format: "csv" | "xlsx") {
    setExportAction({ pending: true, error: null, success: null });
    try {
      const response = await fetch(`/organizer/competition/${competitionId}/exports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": crypto.randomUUID(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          format,
          scope: "leaderboard_history",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            exportJobId?: string;
            format?: "csv" | "xlsx";
            status?: ExportJob["status"];
            createdAt?: string | null;
            requestedBy?: string;
          }
        | null;

      if (!response.ok) {
        setExportAction({
          pending: false,
          error: payload?.message ?? "Unable to queue export job.",
          success: null,
        });
        return;
      }

      const exportJobId = payload?.exportJobId;
      const exportFormat = payload?.format;
      const exportStatus = payload?.status;
      const requestedBy = payload?.requestedBy ?? "";
      const createdAt = payload?.createdAt ?? new Date().toISOString();

      if (
        typeof exportJobId === "string" &&
        (exportFormat === "csv" || exportFormat === "xlsx") &&
        isExportJobStatus(exportStatus)
      ) {
        setJobRows((current) => [
          {
            id: exportJobId,
            competitionId,
            requestedBy,
            format: exportFormat,
            scope: "leaderboard_history",
            status: exportStatus,
            storagePath: null,
            errorMessage: null,
            requestIdempotencyToken: "",
            createdAt,
            updatedAt: createdAt,
            completedAt: null,
          },
          ...current,
        ]);
      }

      setExportAction({
        pending: false,
        error: null,
        success: `${format.toUpperCase()} export queued.`,
      });
    } catch (error) {
      setExportAction({
        pending: false,
        error: error instanceof Error ? error.message : "Unable to queue export job.",
        success: null,
      });
    }
  }

  async function resolveDispute(
    disputeId: string,
    status: "reviewing" | "accepted" | "rejected" | "resolved",
  ) {
    const dispute = disputeRows.find((row) => row.id === disputeId);
    const resolutionNote = (resolutionDrafts[disputeId] ?? dispute?.resolutionNote ?? "").trim();

    if (status === "accepted" || status === "rejected" || status === "resolved") {
      if (!resolutionNote) {
        setDisputeAction({
          pending: false,
          error: "Resolution note is required.",
          success: null,
        });
        return;
      }
    }

    setDisputeAction({ pending: true, error: null, success: null });
    try {
      const response = await fetch(
        `/api/organizer/competitions/${competitionId}/disputes/${disputeId}/resolve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": crypto.randomUUID(),
          },
          credentials: "same-origin",
          body: JSON.stringify({
            status,
            resolutionNote,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; status?: CompetitionDispute["status"]; resolvedAt?: string | null }
        | null;

      if (!response.ok) {
        setDisputeAction({
          pending: false,
          error: payload?.message ?? "Unable to resolve dispute.",
          success: null,
        });
        return;
      }

      setDisputeRows((current) =>
        current.map((dispute) =>
          dispute.id === disputeId
            ? {
                ...dispute,
                status: payload?.status ?? status,
                resolutionNote: resolutionNote || dispute.resolutionNote,
                resolvedAt: payload?.resolvedAt ?? dispute.resolvedAt,
              }
            : dispute,
        ),
      );
      setResolutionDrafts((current) => {
        const next = { ...current };
        delete next[disputeId];
        return next;
      });

      setDisputeAction({
        pending: false,
        error: null,
        success: "Dispute updated.",
      });
    } catch (error) {
      setDisputeAction({
        pending: false,
        error: error instanceof Error ? error.message : "Unable to resolve dispute.",
        success: null,
      });
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#10182b]">Leaderboard publish state</h2>
            <p className="mt-1 text-sm text-slate-500">
              Scheduled competitions stay hidden from mathletes until published.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {published ? "Published" : "Unpublished"}
            </span>
            <button
              type="button"
              disabled={publishAction.pending || published}
              onClick={publishLeaderboard}
              className="rounded-xl bg-[#10182b] px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {publishAction.pending ? "Publishing..." : published ? "Published" : "Publish leaderboard"}
            </button>
          </div>
        </div>
        {publishAction.error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {publishAction.error}
          </p>
        ) : null}
        {publishAction.success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {publishAction.success}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#10182b]">Answer key release</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hidden answer keys can be released to eligible mathletes with an inbox link.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                releasedAnswerKey ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              {releasedAnswerKey ? "Released" : "Hidden"}
            </span>
            <button
              type="button"
              disabled={answerKeyAction.pending || releasedAnswerKey}
              onClick={releaseAnswerKey}
              className="rounded-xl bg-[#10182b] px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {answerKeyAction.pending ? "Releasing..." : releasedAnswerKey ? "Released" : "Release answer key"}
            </button>
          </div>
        </div>
        {answerKeyAction.error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {answerKeyAction.error}
          </p>
        ) : null}
        {answerKeyAction.success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {answerKeyAction.success}
          </p>
        ) : null}
      </section>

      <LeaderboardStandings
        entries={entries}
        format={format}
        actions={
          <>
            <button
              type="button"
              disabled={exportAction.pending}
              onClick={() => queueExport("csv")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export CSV
            </button>
            <button
              type="button"
              disabled={exportAction.pending}
              onClick={() => queueExport("xlsx")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export XLSX
            </button>
          </>
        }
      >
        {exportAction.error ? (
          <p className="mx-6 my-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {exportAction.error}
          </p>
        ) : null}
        {exportAction.success ? (
          <p className="mx-6 my-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {exportAction.success}
          </p>
        ) : null}
      </LeaderboardStandings>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-[#10182b]">Disputes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Resolve disputes and trigger recalculation for accepted corrections.
        </p>
        <div className="mt-4 space-y-4">
          {disputeRows.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No disputes yet.
            </p>
          ) : null}
          {disputeRows.map((dispute) => {
            const terminal = !nonTerminalDisputeIds.has(dispute.id);
            return (
              <article key={dispute.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusBadgeClass(dispute.status)}`}>
                      {dispute.status}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Reporter: {dispute.reporterName}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(dispute.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {dispute.reason}
                </div>
                {dispute.problemLatex ? (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <KatexPreview latex={dispute.problemLatex} displayMode />
                  </div>
                ) : null}
                {dispute.resolutionNote ? (
                  <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {dispute.resolutionNote}
                  </p>
                ) : null}
                {!terminal ? (
                  <div className="mt-3 space-y-2">
                    <label
                      htmlFor={`resolution-note-${dispute.id}`}
                      className="text-xs font-black uppercase tracking-[0.12em] text-slate-500"
                    >
                      Resolution note
                    </label>
                    <textarea
                      id={`resolution-note-${dispute.id}`}
                      value={resolutionDrafts[dispute.id] ?? ""}
                      onChange={(event) =>
                        setResolutionDrafts((current) => ({
                          ...current,
                          [dispute.id]: event.target.value,
                        }))
                      }
                      maxLength={1000}
                      placeholder="Required when accepting, rejecting, or resolving."
                      className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
                    />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={disputeAction.pending || terminal}
                    onClick={() => resolveDispute(dispute.id, "reviewing")}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark reviewing
                  </button>
                  <button
                    type="button"
                    disabled={disputeAction.pending || terminal}
                    onClick={() => resolveDispute(dispute.id, "accepted")}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={disputeAction.pending || terminal}
                    onClick={() => resolveDispute(dispute.id, "rejected")}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={disputeAction.pending || terminal}
                    onClick={() => resolveDispute(dispute.id, "resolved")}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resolve
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {disputeAction.error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {disputeAction.error}
          </p>
        ) : null}
        {disputeAction.success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {disputeAction.success}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-[#10182b]">Export jobs</h2>
        <div className="mt-4 space-y-2">
          {jobRows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No export jobs yet.
            </p>
          ) : null}
          {jobRows.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-700">
                  {job.format.toUpperCase()} · {job.scope}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${exportStatusBadgeClass(job.status)}`}>
                {job.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
