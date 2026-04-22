import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

export const organizerPrimaryActionClass =
  "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export const organizerSecondaryActionClass =
  "inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface OrganizerWorkspaceShellProps {
  children: ReactNode;
  className?: string;
}

export function OrganizerWorkspaceShell({
  children,
  className,
}: OrganizerWorkspaceShellProps) {
  return <section className={cn("shell py-8 md:py-10", className)}>{children}</section>;
}

interface OrganizerWorkspacePanelProps {
  children: ReactNode;
  className?: string;
}

export function OrganizerWorkspacePanel({
  children,
  className,
}: OrganizerWorkspacePanelProps) {
  return (
    <div
      className={cn(
        "surface-card rounded-2xl border border-border/60 bg-background/80 p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface OrganizerBreadcrumbItem {
  label: string;
  href?: string;
}

interface OrganizerWorkspaceHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  breadcrumbs?: OrganizerBreadcrumbItem[];
  className?: string;
}

export function OrganizerWorkspaceHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
  className,
}: OrganizerWorkspaceHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <div key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
                {item.href && !isLast ? (
                  <ProgressLink
                    href={item.href}
                    className="font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </ProgressLink>
                ) : (
                  <span className={cn(isLast ? "text-foreground font-medium" : "")}>{item.label}</span>
                )}
                {!isLast ? <ChevronRight className="size-3.5 text-muted-foreground/70" /> : null}
              </div>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="eyebrow">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="section-heading text-4xl">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

interface OrganizerMetricTileProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

export function OrganizerMetricTile({
  label,
  value,
  hint,
  className,
}: OrganizerMetricTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}