type UpcomingCompetitionTimestampSource = {
  timestamp: string | null;
};

function parseTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getUpcomingCompetitionRefreshDelayMs(
  upcomingCards: readonly UpcomingCompetitionTimestampSource[],
  now = Date.now(),
) {
  let earliestTimestamp: number | null = null;

  for (const card of upcomingCards) {
    const timestamp = parseTimestamp(card.timestamp);
    if (timestamp === null) {
      continue;
    }

    if (earliestTimestamp === null || timestamp < earliestTimestamp) {
      earliestTimestamp = timestamp;
    }
  }

  if (earliestTimestamp === null) {
    return null;
  }

  const delay = earliestTimestamp - now;
  return Math.max(0, delay);
}