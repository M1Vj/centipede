"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUpcomingCompetitionRefreshDelayMs } from "@/lib/competition/upcoming-refresh";

type UpcomingCompetitionRefreshProps = {
  upcomingCards: ReadonlyArray<{
    timestamp: string | null;
  }>;
};

export function UpcomingCompetitionRefresh({ upcomingCards }: UpcomingCompetitionRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const delayMs = getUpcomingCompetitionRefreshDelayMs(upcomingCards);
    if (delayMs === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh();
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [router, upcomingCards]);

  return null;
}