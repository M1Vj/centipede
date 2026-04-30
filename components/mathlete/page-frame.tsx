import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MathletePageFrameProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function MathletePageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: MathletePageFrameProps) {
  return (
    <section className={cn("shell pb-16 pt-8 md:pt-10", className)}>
      <div className="space-y-8">
        <header
          className={cn(
            "relative overflow-hidden rounded-[2.25rem] bg-[#1a1e2e] px-6 py-7 text-white shadow-[0_32px_72px_-42px_rgba(26,30,46,0.82)] sm:px-8 sm:py-8 md:px-10",
            headerClassName,
          )}
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(244,151,0,0.24),transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 h-40 w-40 rounded-full bg-white/6 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              {eyebrow ? (
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#f49700]">
                  {eyebrow}
                </p>
              ) : null}
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-black tracking-normal text-white md:text-5xl">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            {actions ? (
              <div className="relative flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div>
            ) : null}
          </div>
        </header>

        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}
