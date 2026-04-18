import type { ReactNode } from "react";
import { X } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";

type MathleteModalPanelProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  closeHref?: string;
  closeLabel?: string;
  children: ReactNode;
  className?: string;
};

export function MathleteModalPanel({
  title,
  description,
  eyebrow,
  closeHref = "/mathlete/teams",
  closeLabel = "Close panel",
  children,
  className,
}: MathleteModalPanelProps) {
  return (
    <section className="shell flex min-h-[calc(100vh-9rem)] items-center justify-center pb-16 pt-6 md:pt-10">
      <div className="relative w-full max-w-[720px]">
        <div className="absolute inset-0 rounded-[2.25rem] bg-slate-950/10 blur-3xl" aria-hidden="true" />
        <div
          className={cn(
            "relative rounded-[2.25rem] border border-white/70 bg-white px-6 py-7 shadow-[0_36px_80px_-42px_rgba(15,23,42,0.45)] sm:px-8 sm:py-9 md:px-10",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              {eyebrow ? (
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">
                  {eyebrow}
                </p>
              ) : null}
              <div className="space-y-2">
                <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-[#13233b]">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-xl text-sm leading-7 text-slate-500 md:text-base">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            <ProgressLink
              href={closeHref}
              aria-label={closeLabel}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-5" />
            </ProgressLink>
          </div>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
