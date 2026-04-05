export type UserSearchRecord = {
  id: string;
  created_at: string | null;
};

export function sanitizeUserSearchTerm(value: string) {
  return value
    .replace(/[(),"'\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function getCreatedAtTimestamp(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function mergeDedupeSortUsersByCreatedAtDesc<T extends UserSearchRecord>(
  fullNameMatches: readonly T[],
  emailMatches: readonly T[],
) {
  const deduped = new Map<string, T>();

  for (const row of [...fullNameMatches, ...emailMatches]) {
    if (!deduped.has(row.id)) {
      deduped.set(row.id, row);
      continue;
    }

    const existing = deduped.get(row.id);
    if (!existing) {
      deduped.set(row.id, row);
      continue;
    }

    const existingTimestamp = getCreatedAtTimestamp(existing.created_at);
    const nextTimestamp = getCreatedAtTimestamp(row.created_at);

    if (nextTimestamp > existingTimestamp) {
      deduped.set(row.id, row);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const rightCreatedAt = getCreatedAtTimestamp(right.created_at);
    const leftCreatedAt = getCreatedAtTimestamp(left.created_at);

    if (rightCreatedAt !== leftCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    return left.id.localeCompare(right.id);
  });
}
