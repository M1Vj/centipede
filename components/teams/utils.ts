type PayloadWithMessage = {
  message?: string | null;
};

export function createIdempotencyToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const timeSegment = Date.now().toString(36);
  const randomSegment = Math.random().toString(36).slice(2, 12);
  return `req-${timeSegment}-${randomSegment}`;
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getPayloadMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as PayloadWithMessage).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as T | null;
  const message = getPayloadMessage(payload, response.ok ? "" : "Request failed.");

  return {
    ok: response.ok,
    status: response.status,
    payload,
    message,
  };
}
