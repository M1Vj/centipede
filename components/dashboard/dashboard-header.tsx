import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  name?: string;
  className?: string;
};

export function DashboardHeader({ name, className }: DashboardHeaderProps) {
  const displayName = name || "Organizer";

  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-[32px] md:text-[36px] font-black text-[#10182b] tracking-tight leading-tight">
        Welcome back, <span className="text-[#f49700]">{displayName}</span>
      </h1>
    </div>
  );
}
