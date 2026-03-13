"use client";

import { useEffect, useId, useRef } from "react";

export function useFormStatusRegion(message?: string | null) {
  const statusId = useId();
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) {
      statusRef.current?.focus();
    }
  }, [message]);

  return {
    statusId,
    statusRef,
  };
}
