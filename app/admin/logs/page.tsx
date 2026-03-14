import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, User, Info, Clock, ExternalLink } from "lucide-react";

async function AuditLogsList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-muted-foreground font-medium">Reading system audit stream...</div>;
  
  // Combine multiple log sources for a unified view
  // 1. Competition events
  const { data: events, error: eventError } = await admin
    .from("competition_events")
    .select(`
      *,
      profiles:actor_user_id (full_name),
      competitions:competition_id (name)
    `)
    .order("happened_at", { ascending: false })
    .limit(20);

  if (eventError) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load system events.</div>;
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <History className="size-10 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No recent system activity recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <Card key={event.id} className="border-border/60 bg-background/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-4">
               <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                  event.event_type === 'published' ? 'bg-green-500/10 text-green-600' :
                  event.event_type === 'paused' ? 'bg-amber-500/10 text-amber-600' :
                  event.event_type === 'resumed' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-primary/10 text-primary'
               }`}>
                  <Info className="size-5" />
               </div>
               
               <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                     <p className="text-sm font-semibold truncate leading-none">
                        Competition <span className="text-primary">{event.competitions?.name || "Unknown"}</span> was {event.event_type}
                     </p>
                     <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                        {event.event_type.toUpperCase()}
                     </Badge>
                  </div>
                  
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                     <div className="flex items-center gap-1">
                        <User className="size-3" />
                        <span>Actor: {event.profiles?.full_name || "System"}</span>
                     </div>
                     <div className="flex items-center gap-1 border-l pl-4">
                        <Clock className="size-3" />
                        <span>{new Date(event.happened_at).toLocaleString()}</span>
                     </div>
                  </div>
               </div>
               
               <div className="px-4">
                  <ExternalLink className="size-4 text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer" />
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
        <Button variant="outline" size="sm" className="gap-2">
           <Clock className="size-4" />
           Live Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        <Suspense fallback={<LogsSkeleton />}>
          <AuditLogsList />
        </Suspense>
      </div>
    </div>
  );
}

// Minimal Button internal implementation to avoid too many imports for now or resolve correctly
function Button({ children, variant, size, className, ...props }: any) {
  const variants: any = {
    ghost: "bg-transparent hover:bg-muted text-muted-foreground",
    outline: "border border-input bg-background hover:bg-muted hover:text-accent-foreground shadow-sm",
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
  };
  const sizes: any = {
    icon: "h-10 w-10 p-0",
    sm: "h-8 px-3 text-xs"
  };
  return (
    <button className={`inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant] || ""} ${sizes[size] || ""} ${className || ""}`} {...props}>
      {children}
    </button>
  );
}
