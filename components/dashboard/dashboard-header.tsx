import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  name?: string;
  className?: string;
};

export function DashboardHeader({ name, className }: DashboardHeaderProps) {
  const displayName = name || "Organizer";

  return (
    <div className={cn("space-y-2 text-center", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#f49700]">
        Organizer
      </p>
      <h1 className="text-4xl font-black tracking-[-0.04em] text-[#0d1b2a] md:text-5xl">
        Welcome back, <span className="text-[#f49700]">{displayName}</span>
      </h1>
      <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
        Monitor live competition health, registration momentum, and problem-bank readiness from one workspace.
      </p>
    </div>
  );
}
