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
        <header className={cn("flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between", headerClassName)}>
          <div className="space-y-4">
            {eyebrow ? (
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#f49700]">
                {eyebrow}
              </p>
            ) : null}
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-[#10182b] md:text-5xl">
                {title}
              </h1>
              {description ? (
                <p className="max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </header>

        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}
