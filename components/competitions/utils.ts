export function createIdempotencyToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const timeSegment = Date.now().toString(36);
  const randomSegment = Math.random().toString(36).slice(2, 12);
  return `req-${timeSegment}-${randomSegment}`;
}
