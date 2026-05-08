"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  History,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Search,
  Square,
  TimerReset,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AnnouncementComposer } from "@/components/announcements/announcement-composer";
import type {
  MonitoringAttemptSummary,
  MonitoringCompetitionEvent,
  MonitoringTab,
} from "@/components/monitoring/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressLink } from "@/components/ui/progress-link";
import type { CompetitionRecord, CompetitionStatus } from "@/lib/competition/types";
import type { OrganizerRegistrationDetail, RegistrationStatus } from "@/lib/registrations/types";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PanelMode = "organizer" | "admin";
type ControlAction = "pause" | "resume" | "extend" | "reset" | "end" | "force-pause" | "moderation-delete";

interface CompetitionParticipantsPanelProps {
  competition: CompetitionRecord;
  registrations: OrganizerRegistrationDetail[];
  activeAttempts?: MonitoringAttemptSummary[];
  finishedAttempts?: MonitoringAttemptSummary[];
  events?: MonitoringCompetitionEvent[];
  initialTab?: string | null;
  routePath?: string;
  mode?: PanelMode;
}

const tabs: Array<{ id: MonitoringTab; label: string; icon: typeof UsersRound }> = [
  { id: "participants", label: "Participants", icon: UsersRound },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "timeline", label: "Timeline", icon: History },
];

const statusOptions: Array<RegistrationStatus | "all"> = [
  "all",
  "registered",
  "withdrawn",
  "ineligible",
  "cancelled",
];
const disconnectEvidenceTypes = [
  "attempt_heartbeat_timeout",
  "platform_connection_drop",
  "resume_handshake_reconnect",
] as const;

function normalizeTab(tab: string | null | undefined): MonitoringTab {
  return tab === "announcements" || tab === "timeline" || tab === "participants"
    ? tab
    : "participants";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSeconds(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "n/a";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function statusClass(status: RegistrationStatus) {
  switch (status) {
    case "registered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "withdrawn":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "ineligible":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function riskClass(risk: MonitoringAttemptSummary["riskLevel"]) {
  switch (risk) {
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function countByStatus(registrations: OrganizerRegistrationDetail[], status: RegistrationStatus) {
  return registrations.filter((registration) => registration.status === status).length;
}

function capacityLabel(competition: CompetitionRecord, registeredCount: number) {
  const limit = competition.format === "team" ? competition.maxTeams : competition.maxParticipants;
  return !limit || limit <= 0 ? `${registeredCount}` : `${registeredCount} / ${limit}`;
}

function controlEndpoint(mode: PanelMode, competitionId: string, action: ControlAction) {
  if (mode === "admin") {
    if (action === "force-pause") {
      return `/api/admin/competitions/${competitionId}/monitoring/force-pause`;
    }
    return `/api/admin/competitions/${competitionId}/monitoring/moderate-delete`;
  }

  if (action === "end") {
    return `/api/organizer/competitions/${competitionId}/end`;
  }

  const routeAction = action === "reset" ? "reset-disconnect" : action;
  return `/api/organizer/competitions/${competitionId}/monitoring/${routeAction}`;
}

async function readResponseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body?.code === "string" && body.code.trim() && !response.ok) {
    return `${fallback} (${body.code})`;
  }

  return fallback;
}

function controlCopy(action: ControlAction) {
  switch (action) {
    case "pause":
      return { title: "Pause competition?", confirm: "Confirm pause", accepted: "Pause request accepted." };
    case "resume":
      return { title: "Resume competition?", confirm: "Confirm resume", accepted: "Resume request accepted." };
    case "extend":
      return { title: "Extend attempt window?", confirm: "Confirm extend", accepted: "Extension request accepted." };
    case "reset":
      return { title: "Reset disconnect attempt?", confirm: "Confirm reset", accepted: "Reset request accepted." };
    case "end":
      return { title: "End competition?", confirm: "Confirm end", accepted: "End request accepted." };
    case "force-pause":
      return { title: "Force pause competition?", confirm: "Confirm force pause", accepted: "Force-pause request accepted." };
    case "moderation-delete":
      return { title: "Moderation delete competition?", confirm: "Confirm delete", accepted: "Moderation delete request accepted." };
  }
}

function actionAllowed(
  action: ControlAction,
  status: CompetitionStatus,
  mode: PanelMode,
  competitionType: CompetitionRecord["type"],
) {
  if (mode === "admin") {
    if (action === "force-pause") {
      return status === "live";
    }
    return status !== "draft";
  }

  if (action === "pause") {
    return status === "live" && competitionType === "open";
  }
  if (action === "resume") {
    return status === "paused";
  }
  if (action === "extend") {
    return status === "live" || status === "paused";
  }
  if (action === "end") {
    return status === "live" || status === "paused";
  }
  return status === "live" || status === "paused";
}

function disabledReason(
  action: ControlAction,
  status: CompetitionStatus,
  mode: PanelMode,
  competitionType: CompetitionRecord["type"],
) {
  if (actionAllowed(action, status, mode, competitionType)) {
    return null;
  }

  if (mode === "admin" && action === "force-pause") {
    return "Admin force-pause is available only while competition is live.";
  }
  if (mode === "admin") {
    return "Moderation delete is unavailable for draft competitions.";
  }
  if (action === "pause") {
    if (status === "live" && competitionType !== "open") {
      return "Organizer pause is available only for open live competitions.";
    }
    return "Pause is available only while competition is live.";
  }
  if (action === "resume") {
    return "Resume is available only while competition is paused.";
  }
  if (action === "end") {
    return "End is available only while competition is live or paused.";
  }
  return "Action requires live or paused competition state.";
}

export function CompetitionParticipantsPanel({
  competition,
  registrations,
  activeAttempts = [],
  finishedAttempts = [],
  events = [],
  initialTab,
  routePath = `/organizer/competition/${competition.id}/participants`,
  mode = "organizer",
}: CompetitionParticipantsPanelProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTab = normalizeTab(initialTab);
  const [status, setStatus] = useState(competition.status);
  const [search, setSearch] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | "all">("all");
  const [controlAction, setControlAction] = useState<ControlAction | null>(null);
  const [controlAttemptId, setControlAttemptId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [additionalMinutes, setAdditionalMinutes] = useState(10);
  const [disconnectEvidenceType, setDisconnectEvidenceType] =
    useState<(typeof disconnectEvidenceTypes)[number]>("attempt_heartbeat_timeout");
  const [disconnectEvidenceRef, setDisconnectEvidenceRef] = useState("");
  const [pending, setPending] = useState(false);
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const registeredCount = countByStatus(registrations, "registered");
  const withdrawnCount = countByStatus(registrations, "withdrawn");
  const ineligibleCount = countByStatus(registrations, "ineligible");
  const cancelledCount = countByStatus(registrations, "cancelled");
  const activeAttemptByRegistration = useMemo(
    () => new Map(activeAttempts.map((attempt) => [attempt.registrationId, attempt])),
    [activeAttempts],
  );
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`organizer-monitoring-${competition.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_attempts", filter: `competition_id=eq.${competition.id}` },
        () => {
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = setTimeout(() => {
            router.refresh();
          }, 300);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_registrations", filter: `competition_id=eq.${competition.id}` },
        () => {
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = setTimeout(() => {
            router.refresh();
          }, 300);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_events", filter: `competition_id=eq.${competition.id}` },
        () => {
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = setTimeout(() => {
            router.refresh();
          }, 300);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [competition.id, router]);

  const filteredRegistrations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return registrations.filter((registration) => {
      const matchesStatus = registrationStatus === "all" || registration.status === registrationStatus;
      const haystack = [
        registration.displayName,
        registration.subtitle ?? "",
        registration.statusReason ?? "",
        ...registration.roster.map((member) => `${member.fullName} ${member.school ?? ""} ${member.gradeLevel ?? ""}`),
      ].join(" ").toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [registrations, registrationStatus, search]);
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (left, right) => new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime(),
      ),
    [events],
  );
  const currentControlCopy = controlAction ? controlCopy(controlAction) : null;
  const reasonIsValid = reason.trim().length > 0;
  const canConfirmControl =
    Boolean(controlAction) &&
    reasonIsValid &&
    !pending &&
    (controlAction !== "extend" || additionalMinutes > 0) &&
    (controlAction !== "reset" || disconnectEvidenceRef.trim().length > 0);

  function openControl(action: ControlAction, attemptId?: string) {
    setControlAction(action);
    setControlAttemptId(attemptId ?? null);
    setReason("");
    setAdditionalMinutes(10);
    setDisconnectEvidenceType("attempt_heartbeat_timeout");
    setDisconnectEvidenceRef("");
    setControlError(null);
    setControlMessage(null);
  }

  async function submitControl() {
    if (!controlAction || !canConfirmControl) {
      return;
    }

    setPending(true);
    setControlError(null);
    setControlMessage(null);

    try {
      const payload: Record<string, unknown> = {
        reason: reason.trim(),
      };
      const requestIdempotencyToken = crypto.randomUUID();

      if (controlAction === "extend") {
        payload.additionalMinutes = additionalMinutes;
      }
      if (controlAction === "reset") {
        payload.attemptId = controlAttemptId;
        payload.disconnectEvidenceType = disconnectEvidenceType;
        payload.disconnectEvidenceRef = disconnectEvidenceRef.trim();
      }

      const response = await fetch(controlEndpoint(mode, competition.id, controlAction), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": requestIdempotencyToken,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, "Control request failed."));
      }

      if (controlAction === "pause" || controlAction === "force-pause") {
        setStatus("paused");
      } else if (controlAction === "resume") {
        setStatus("live");
      } else if (controlAction === "end") {
        setStatus("ended");
      }
      setControlMessage(controlCopy(controlAction).accepted);
      setControlAction(null);
      router.refresh();
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Control request failed.");
      setControlAction(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5 font-['Poppins']">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgressLink
          href={mode === "admin" ? "/admin/competitions" : "/organizer/competition"}
          className="text-sm font-bold text-slate-500 transition-colors hover:text-[#f49700]"
        >
          Back to Competitions
        </ProgressLink>
        {mode === "organizer" ? (
          <ProgressLink
            href={`/organizer/competition/${competition.id}`}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#10182b] shadow-sm transition hover:bg-slate-50"
          >
            Competition setup
          </ProgressLink>
        ) : null}
      </div>

      <section className="border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[#fed7aa] bg-[#fff7ed] text-[#c2410c] hover:bg-[#fff7ed]">
                {status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {competition.format}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {competition.type}
              </Badge>
              {mode === "admin" ? <Badge variant="destructive">Admin live support</Badge> : null}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#10182b] md:text-3xl">
                {competition.name || "Untitled competition"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Live control room for registrations, active attempts, announcements, and audit events.
              </p>
            </div>
          </div>
          <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <CalendarClock className="size-4 text-[#f49700]" />
              {formatDateTime(competition.startTime)}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">
              Registration closes {formatDateTime(competition.registrationEnd)}
            </div>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#10182b]">Live controls</h2>
            <p className="mt-1 text-sm text-slate-500">
              Every control requires explicit confirmation, non-empty reason, and idempotency token.
            </p>
            <div className="mt-3 space-y-1 text-sm">
              {mode === "admin" ? (
                <p className="font-semibold text-slate-600">
                  Admin allow list: force-pause and moderation delete only.
                </p>
              ) : (
                <p className="font-semibold text-slate-600">
                  Organizer controls: open pause, resume, scheduled or open end, extend, and eligible disconnect reset.
                </p>
              )}
              {controlMessage ? <p role="status" className="font-semibold text-emerald-700">{controlMessage}</p> : null}
              {controlError ? <p role="alert" className="font-semibold text-red-700">{controlError}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "admin" ? (
              <>
                <GuardedControlButton
                  action="force-pause"
                  status={status}
                  mode={mode}
                  competitionType={competition.type}
                  onOpen={openControl}
                />
                <GuardedControlButton
                  action="moderation-delete"
                  status={status}
                  mode={mode}
                  competitionType={competition.type}
                  onOpen={openControl}
                />
              </>
            ) : (
              <>
                <GuardedControlButton
                  action="pause"
                  status={status}
                  mode={mode}
                  competitionType={competition.type}
                  onOpen={openControl}
                />
                <GuardedControlButton
                  action="resume"
                  status={status}
                  mode={mode}
                  competitionType={competition.type}
                  onOpen={openControl}
                />
                <GuardedControlButton
                  action="extend"
                  status={status}
                  mode={mode}
                  competitionType={competition.type}
                  onOpen={openControl}
                />
                <GuardedControlButton
                  action="end"
                  status={status}
                  mode={mode}
                  competitionType={competition.type}
                  onOpen={openControl}
                />
              </>
            )}
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200" aria-label="Monitoring tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <ProgressLink
              key={tab.id}
              href={`${routePath}?tab=${tab.id}`}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition",
                active
                  ? "border-[#f49700] text-[#10182b]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" />
              {tab.label}
            </ProgressLink>
          );
        })}
      </nav>

      {activeTab === "participants" ? (
        <ParticipantMonitor
          competition={competition}
          registrations={filteredRegistrations}
          allRegistrations={registrations}
          activeAttempts={activeAttempts}
          activeAttemptByRegistration={activeAttemptByRegistration}
          search={search}
          registrationStatus={registrationStatus}
          onSearchChange={setSearch}
          onStatusChange={setRegistrationStatus}
          onResetAttempt={(attemptId) => openControl("reset", attemptId)}
          mode={mode}
          status={status}
          summary={{
            registered: capacityLabel(competition, registeredCount),
            withdrawn: withdrawnCount,
            ineligible: ineligibleCount,
            cancelled: cancelledCount,
          }}
        />
      ) : null}

      {activeTab === "participants" ? (
        <FinishedMathletesPanel attempts={finishedAttempts} />
      ) : null}

      {activeTab === "announcements" ? (
        mode === "organizer" ? (
          <AnnouncementComposer competitionId={competition.id} />
        ) : (
          <section className="border border-slate-200 bg-white px-5 py-12 text-center text-sm font-semibold text-slate-600">
            Admin live support cannot send organizer announcements.
          </section>
        )
      ) : null}

      {activeTab === "timeline" ? <TimelinePanel events={sortedEvents} /> : null}

      <ConfirmDialog
        open={Boolean(controlAction)}
        onOpenChange={(open) => {
          if (!open) {
            setControlAction(null);
          }
        }}
        title={currentControlCopy?.title ?? "Confirm control"}
        description="Record exact operational reason. This reason is written to durable event metadata by backend control contract."
        confirmLabel={currentControlCopy?.confirm ?? "Confirm"}
        confirmVariant={controlAction === "moderation-delete" ? "destructive" : "default"}
        confirmDisabled={!canConfirmControl}
        pending={pending}
        pendingLabel="Submitting..."
        onConfirm={submitControl}
      >
        <div className="grid gap-4">
          {controlAction === "extend" ? (
            <div className="grid gap-2">
              <Label htmlFor="control-minutes">Additional minutes</Label>
              <Input
                id="control-minutes"
                type="number"
                min={1}
                value={additionalMinutes}
                onChange={(event) => setAdditionalMinutes(Number(event.target.value))}
              />
            </div>
          ) : null}
          {controlAction === "reset" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="disconnect-evidence-type">Disconnect evidence type</Label>
                <select
                  id="disconnect-evidence-type"
                  value={disconnectEvidenceType}
                  onChange={(event) =>
                    setDisconnectEvidenceType(event.target.value as (typeof disconnectEvidenceTypes)[number])
                  }
                  className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {disconnectEvidenceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="disconnect-evidence-ref">Disconnect evidence event id</Label>
                <Input
                  id="disconnect-evidence-ref"
                  value={disconnectEvidenceRef}
                  onChange={(event) => setDisconnectEvidenceRef(event.target.value)}
                  placeholder="Detection event UUID"
                  required
                />
              </div>
            </>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="control-reason">Control reason</Label>
            <textarea
              id="control-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function GuardedControlButton({
  action,
  status,
  mode,
  competitionType,
  onOpen,
}: {
  action: ControlAction;
  status: CompetitionStatus;
  mode: PanelMode;
  competitionType: CompetitionRecord["type"];
  onOpen: (action: ControlAction) => void;
}) {
  const reason = disabledReason(action, status, mode, competitionType);
  const Icon =
    action === "pause" || action === "force-pause"
      ? Pause
      : action === "resume"
        ? Play
        : action === "extend"
          ? TimerReset
          : action === "moderation-delete"
            ? Trash2
            : action === "end"
              ? Square
              : RotateCcw;
  const label =
    action === "force-pause"
      ? "Force pause"
      : action === "moderation-delete"
        ? "Moderation delete"
        : action === "pause"
          ? "Pause competition"
        : action === "resume"
          ? "Resume competition"
          : action === "end"
            ? "End competition"
            : "Extend time";

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={action === "moderation-delete" ? "destructive" : "outline"}
        onClick={() => onOpen(action)}
        disabled={Boolean(reason)}
        title={reason ?? undefined}
      >
        <Icon className="size-4" />
        {label}
      </Button>
      {reason ? <span className="max-w-44 text-xs font-medium text-slate-500">{reason}</span> : null}
    </div>
  );
}

function ParticipantMonitor({
  competition,
  registrations,
  allRegistrations,
  activeAttempts,
  activeAttemptByRegistration,
  search,
  registrationStatus,
  onSearchChange,
  onStatusChange,
  onResetAttempt,
  mode,
  status,
  summary,
}: {
  competition: CompetitionRecord;
  registrations: OrganizerRegistrationDetail[];
  allRegistrations: OrganizerRegistrationDetail[];
  activeAttempts: MonitoringAttemptSummary[];
  activeAttemptByRegistration: Map<string, MonitoringAttemptSummary>;
  search: string;
  registrationStatus: RegistrationStatus | "all";
  onSearchChange: (value: string) => void;
  onStatusChange: (value: RegistrationStatus | "all") => void;
  onResetAttempt: (attemptId: string) => void;
  mode: PanelMode;
  status: CompetitionStatus;
  summary: { registered: string; withdrawn: number; ineligible: number; cancelled: number };
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="text-lg font-black text-[#10182b]">Participant monitor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Competition-scoped registrations with active attempt risk summaries.
          </p>
        </div>
        <Badge variant="outline">{allRegistrations.length} total</Badge>
      </div>

      <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Registered" value={summary.registered} />
        <Metric label="Withdrawn" value={summary.withdrawn} />
        <Metric label="Ineligible" value={summary.ineligible} />
        <Metric label="Cancelled" value={summary.cancelled} />
      </div>

      <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-[1fr_220px]">
        <div className="grid gap-2">
          <Label htmlFor="participant-search">Search participants</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="participant-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-9"
              placeholder="Name, school, team code"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="registration-status">Registration status</Label>
          <select
            id="registration-status"
            value={registrationStatus}
            onChange={(event) => onStatusChange(event.target.value as RegistrationStatus | "all")}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {competition.status === "draft" ? (
        <EmptyState icon={Clock3} title="Publish competition before registrations open." />
      ) : registrations.length === 0 ? (
        <EmptyState icon={UsersRound} title="No participants match current filters." />
      ) : (
        <div className="divide-y divide-slate-100">
          {registrations.map((registration) => {
            const attempt = activeAttemptByRegistration.get(registration.id) ?? null;
            return (
              <article key={registration.id} className="px-5 py-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(520px,1.8fr)] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {registration.teamId ? (
                        <UsersRound className="size-4 text-slate-400" />
                      ) : (
                        <UserRound className="size-4 text-slate-400" />
                      )}
                      <h3 className="font-bold text-[#10182b]">{registration.displayName}</h3>
                      {registration.subtitle ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                          {registration.subtitle}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClass(registration.status)}>
                        {registration.status}
                      </Badge>
                      <span className="text-xs font-medium text-slate-500">
                        Registered {formatDateTime(registration.registeredAt)}
                      </span>
                    </div>
                    {registration.statusReason ? (
                      <p className="mt-3 border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        Reason: {registration.statusReason}
                      </p>
                    ) : null}
                    {registration.roster.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {registration.roster.map((participant, index) => (
                          <div
                            key={`${registration.id}-${participant.profileId ?? index}`}
                            className="grid gap-2 border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.6fr]"
                          >
                            <span className="font-semibold text-slate-800">{participant.fullName}</span>
                            <span className="text-slate-600">{participant.school ?? "School not provided"}</span>
                            <span className="text-slate-600">{participant.gradeLevel ?? "Grade not provided"}</span>
                            <span className="capitalize text-slate-500">{participant.role ?? "Participant"}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <AttemptSummary
                    attempt={attempt}
                    onResetAttempt={onResetAttempt}
                    mode={mode}
                    status={status}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeAttempts.length > 0 ? (
        <div className="border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-500">
          Active attempts: {activeAttempts.length}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#10182b]">{value}</p>
    </div>
  );
}

function AttemptSummary({
  attempt,
  onResetAttempt,
  mode,
  status,
}: {
  attempt: MonitoringAttemptSummary | null;
  onResetAttempt: (attemptId: string) => void;
  mode: PanelMode;
  status: CompetitionStatus;
}) {
  if (!attempt) {
    return (
      <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
        No active attempt.
      </div>
    );
  }

  const score = attempt.score === null ? "Score n/a" : `Score ${attempt.score} / ${attempt.maxScore ?? 100}`;
  const answered =
    attempt.answeredCount === null || attempt.totalQuestions === null
      ? "Progress n/a"
      : `${attempt.answeredCount} / ${attempt.totalQuestions} answered`;
  const canReset = mode === "organizer" && (status === "live" || status === "paused");

  return (
    <div className="border border-slate-200 bg-white">
      <div className="grid gap-3 p-4 md:grid-cols-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Attempt</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{attempt.status}</p>
          <p className="mt-1 text-xs text-slate-500">Seen {formatDateTime(attempt.lastSeenAt)}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Score</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{score}</p>
          <p className="mt-1 text-xs text-slate-500">{answered}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Clock</p>
          <p className="mt-1 text-sm font-bold text-slate-900">Left {formatSeconds(attempt.remainingSeconds)}</p>
          <p className="mt-1 text-xs text-slate-500">Elapsed {formatSeconds(attempt.elapsedSeconds)}</p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <Badge variant="outline" className={riskClass(attempt.riskLevel)}>
            {attempt.riskLevel[0].toUpperCase() + attempt.riskLevel.slice(1)} risk
          </Badge>
          <Badge variant="outline" className={attempt.offenseCount > 0 ? "border-red-200 text-red-700" : ""}>
            Offenses {attempt.offenseCount}
          </Badge>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="h-2 overflow-hidden bg-slate-100" aria-label={`${attempt.progressPercent}% progress`}>
          <div
            className={cn(
              "h-full",
              attempt.riskLevel === "high"
                ? "bg-red-500"
                : attempt.riskLevel === "medium"
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
            style={{ width: `${Math.max(0, Math.min(100, attempt.progressPercent))}%` }}
          />
        </div>
        {mode === "organizer" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => onResetAttempt(attempt.attemptId)}
            disabled={!canReset}
          >
            <RotateCcw className="size-4" />
            Reset disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FinishedMathletesPanel({ attempts }: { attempts: MonitoringAttemptSummary[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-2 border-b border-slate-100 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-lg font-black text-[#10182b]">Finished mathletes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Submitted, auto-submitted, disqualified, and graded attempts separated from live attempt monitoring.
          </p>
        </div>
        <Badge variant="outline">{attempts.length} finished</Badge>
      </div>

      {attempts.length === 0 ? (
        <EmptyState icon={Clock3} title="No finished mathletes yet." />
      ) : (
        <div className="divide-y divide-slate-100">
          {attempts.map((attempt) => (
            <article key={attempt.attemptId} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[#10182b]">{attempt.displayName}</h3>
                  <Badge variant="outline" className="capitalize">
                    {attempt.status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase())}
                  </Badge>
                  <Badge variant="outline" className={riskClass(attempt.riskLevel)}>
                    {attempt.riskLevel[0].toUpperCase() + attempt.riskLevel.slice(1)} risk
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Seen {formatDateTime(attempt.lastSeenAt)} · Offenses {attempt.offenseCount}
                </p>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {attempt.score === null ? "Score n/a" : `Score ${attempt.score} / ${attempt.maxScore ?? 100}`}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TimelinePanel({ events }: { events: MonitoringCompetitionEvent[] }) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-black text-[#10182b]">Competition timeline</h2>
        <p className="mt-1 text-sm text-slate-500">
          Chronological event log for lifecycle controls, incidents, and monitoring outcomes.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={History} title="No competition events recorded yet." />
      ) : (
        <div className="divide-y divide-slate-100">
          {events.map((event) => (
            <article key={event.id} data-testid="timeline-entry" className="grid gap-3 px-5 py-4 lg:grid-cols-[180px_1fr]">
              <time className="text-sm font-bold text-slate-500">{formatDateTime(event.happenedAt)}</time>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{event.eventType}</Badge>
                  {event.controlAction ? <Badge className="bg-slate-900 text-white">{event.controlAction}</Badge> : null}
                  {event.result ? <Badge variant="outline">{event.result}</Badge> : null}
                </div>
                <div className="mt-2 grid gap-1 text-sm text-slate-600">
                  <p>
                    <span className="font-bold text-slate-900">Reason:</span>{" "}
                    {event.reason ?? "No reason recorded"}
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Actor:</span>{" "}
                    {[event.actorName ?? "Unknown", event.actorRole].filter(Boolean).join(" / ")}
                  </p>
                  {Object.keys(event.metadata).length > 0 ? (
                    <p className="break-words text-xs font-medium text-slate-500">
                      Metadata {JSON.stringify(event.metadata)}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({ icon: Icon, title }: { icon: typeof AlertTriangle; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <Icon className="mb-4 size-10 text-slate-300" />
      <p className="font-bold text-slate-700">{title}</p>
    </div>
  );
}
