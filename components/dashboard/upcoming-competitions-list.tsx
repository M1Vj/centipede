import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompetitionRecord } from "@/lib/competition/types";
import { cn } from "@/lib/utils";

export function UpcomingCompetitionsList({
  className,
  competitions = []
}: {
  className?: string;
  competitions?: CompetitionRecord[];
}) {
  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">
          Upcoming Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {competitions.length === 0 ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              No upcoming competitions.
            </div>
          ) : (
            competitions
              .filter(comp => comp.status === "published" || comp.status === "paused" || comp.status === "live")
              .slice(0, 3)
              .map((event) => {
                const startDate = event.startTime ? new Date(event.startTime) : null;
                const formattedDate = startDate ? startDate.toLocaleDateString() : "TBD";
                const formattedTime = startDate
                  ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "Flexible Window";

                return (
                  <div key={event.id} className="flex gap-4 p-5 transition-colors hover:bg-muted/10">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CalendarDays className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground">
                        {event.name || "Untitled"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formattedDate}</span>
                        <span className="h-1 w-1 rounded-full bg-border/80" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
