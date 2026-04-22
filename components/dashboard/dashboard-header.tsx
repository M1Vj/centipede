import { cn } from "@/lib/utils";

export function DashboardHeader({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const displayName = name || "Organizer";

  return (
    <div className={cn("mx-auto w-full max-w-5xl space-y-3 text-center", className)}>
      <span className="organizer-kicker">Organizer workspace</span>
      <h1 className="section-heading text-[32px] leading-tight text-foreground md:text-[44px]">
        Welcome back, <span className="text-primary">{displayName}</span>
      </h1>
      <p className="mx-auto max-w-2xl text-sm leading-6 text-foreground/65 md:text-[15px]">
        Track launches, problem banks, and live competition health from one calm surface.
      </p>
    </div>
  );
}
