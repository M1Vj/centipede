"use client";

import type { ReactNode } from "react";

type LocalDateTimeProps = {
  value: string | null;
  fallback?: ReactNode;
  options?: Intl.DateTimeFormatOptions;
};

export function LocalDateTime({ value, fallback = "TBD", options }: LocalDateTimeProps) {
  if (!value) {
    return <span>{fallback}</span>;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span>{fallback}</span>;
  }

  return <span>{date.toLocaleString(undefined, options)}</span>;
}
