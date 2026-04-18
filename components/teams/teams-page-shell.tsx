import type { ReactNode } from "react";
import { MathletePageFrame } from "@/components/mathlete/page-frame";

type TeamsPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  badge?: string;
  className?: string;
};

export function TeamsPageShell({
  title,
  description,
  children,
  actions,
  badge = "Workspace",
  className,
}: TeamsPageShellProps) {
  return (
    <MathletePageFrame
      eyebrow={badge}
      title={title}
      description={description}
      actions={actions}
      className={className}
    >
      {children}
    </MathletePageFrame>
  );
}
