import { Suspense } from "react";
import { getAdminStats } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Users, 
  FileText, 
  Trophy, 
  Library, 
  ArrowRight,
  Activity,
  AlertCircle,
  ShieldAlert
} from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

async function DashboardStats() {
  const stats = await getAdminStats();

  const cards = [
    { 
      label: "Total Users", 
      value: stats.users, 
      icon: Users, 
      href: "/admin/users",
      color: "bg-blue-500/10 text-blue-600"
    },
    { 
      label: "Pending Apps", 
      value: stats.pendingApplications, 
      icon: FileText, 
      href: "/admin/applications",
      color: "bg-amber-500/10 text-amber-600",
      alert: stats.pendingApplications > 0
    },
    { 
      label: "Competitions", 
      value: stats.activeCompetitions, 
      icon: Trophy, 
      href: "/admin/competitions",
      color: "bg-emerald-500/10 text-emerald-600"
    },
    { 
      label: "Problem Banks", 
      value: stats.problemBanks, 
      icon: Library, 
      href: "/admin/problem-banks",
      color: "bg-purple-500/10 text-purple-600"
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              {card.label}
            </CardTitle>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}>
              <card.icon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold tracking-tight">{card.value}</div>
              {card.alert && (
                <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 uppercase tracking-tighter">
                  <AlertCircle className="size-3" />
                  Action Required
                </div>
              )}
            </div>
            <ProgressLink 
              href={card.href} 
              className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View Detailed Report
              <ArrowRight className="size-3" />
            </ProgressLink>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-border/60 animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-4 w-24 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="mt-4 h-3 w-32 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="shell py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back to the Mathwiz Arena admin portal. Here's a summary of platform health.
        </p>
      </div>

      <Suspense fallback={<StatCardSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <CardTitle>Recent System Activity</CardTitle>
            </div>
            <CardDescription>Real-time logs from the platform actions.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t bg-muted/5">
            <p className="text-sm text-muted-foreground italic">Activity monitoring will be enabled in the Audit Logs module.</p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500" />
              <CardTitle>Security Notifications</CardTitle>
            </div>
            <CardDescription>Critical alerts and sensitive system warnings.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t bg-muted/5">
             <div className="text-center">
                <ShieldAlert className="size-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No critical security vulnerabilities detected.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
