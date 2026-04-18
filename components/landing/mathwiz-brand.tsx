"use client";

import { cn } from "@/lib/utils";

type MathwizBrandProps = {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showText?: boolean;
  size?: number;
};

export function MathwizBrand({
  className,
  iconClassName,
  labelClassName,
  showText = true,
  size = 40,
}: MathwizBrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn("relative inline-flex shrink-0 items-center justify-center", iconClassName)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" className="h-full w-full" fill="none">
          <path
            d="M12 55 21 14l10 18-7 23H12Z"
            fill="#1D3475"
          />
          <path
            d="m29 55 8-34 15 34h-12l-5-13-3 13H29Z"
            fill="#243C86"
          />
          <path
            d="M8 22c7-1 11-6 13-11 4 1 8 4 10 8-6 0-11 3-16 8l-7-5Z"
            fill="#F59B00"
          />
          <path
            d="M13 29c8-5 16-7 25-6"
            stroke="#F59B00"
            strokeLinecap="round"
            strokeWidth="3.5"
          />
        </svg>
      </span>
      {showText ? (
        <span className={cn("text-2xl font-bold tracking-[-0.04em] text-inherit", labelClassName)}>
          MathWiz
        </span>
      ) : null}
    </span>
  );
}
