import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, User, Info, Clock, ShieldAlert } from "lucide-react";
import { RefreshButton } from "@/app/admin/logs/refresh-button";

async function AuditLogsList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-muted-foreground font-medium">Reading system audit stream...</div>;

  const [eventsResult, auditResult] = await Promise.all([
    admin
      .from("competition_events")
      .select(`
        *,
        profiles:actor_user_id (full_name),
        competitions:competition_id (name)
      `)
      .order("happened_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_audit_logs")
      .select(`
        *,
        profiles:actor_user_id (full_name)
      `)
      .order("happened_at", { ascending: false })
      .limit(20),
  ]);

  if (eventsResult.error || auditResult.error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load system events.</div>;
  }

  const competitionEvents = (eventsResult.data ?? []).map((event) => ({
    id: event.id as string,
    type: "competition" as const,
    title: `Competition ${event.competitions?.name || "Unknown"} was ${event.event_type}`,
    badge: event.event_type.toUpperCase(),
    actor: event.profiles?.full_name || "System",
    happenedAt: event.happened_at,
  }));

  const adminLogs = (auditResult.data ?? []).map((log) => ({
    id: log.id as string,
    type: "admin" as const,
    title: log.description || "Administrative action",
    badge: (log.action_type as string).toUpperCase(),
    actor: log.profiles?.full_name || "System",
    happenedAt: log.happened_at,
  }));

  const logs = [...competitionEvents, ...adminLogs].sort((a, b) =>
    new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
  );

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <History className="size-10 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No recent system activity recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <Card key={`${log.type}-${log.id}`} className="border-border/60 bg-background/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${log.type === "admin"
                  ? "bg-rose-500/10 text-rose-600"
                  : log.badge === "PUBLISHED"
                    ? "bg-green-500/10 text-green-600"
                    : log.badge === "PAUSED"
                      ? "bg-amber-500/10 text-amber-600"
                      : log.badge === "RESUMED"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-primary/10 text-primary"
                  }`}
              >
                {log.type === "admin" ? (
                  <ShieldAlert className="size-5" />
                ) : (
                  <Info className="size-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate leading-none">
                    {log.title}
                  </p>
                  <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                    {log.badge}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="size-3" />
                    <span>Actor: {log.actor}</span>
                  </div>
                  <div className="flex items-center gap-1 border-l pl-4">
                    <Clock className="size-3" />
                    <span>{new Date(log.happenedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LogsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="animate-pulse border-border/60 h-20" />
      ))}
    </div>
  );
}

export default function AdminLogsPage() {
  return (
    <div className="shell py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Audit Logs</h1>
          <p className="mt-2 text-muted-foreground">
            A comprehensive trail of critical administrative and organizer actions.
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="grid gap-6">
        <Suspense fallback={<LogsSkeleton />}>
          <AuditLogsList />
        </Suspense>
      </div>
    </div>
  );
}
