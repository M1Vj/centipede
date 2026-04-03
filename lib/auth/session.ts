import type { NextResponse } from "next/server";

export const SESSION_VERSION_COOKIE = "centipede-session-version";

type SessionAwareProfile = {
  session_version?: number | string | null;
};

type SessionSchemaError = {
  code?: string | null;
  message?: string | null;
};

type CookieLikeStore = {
  get(name: string): { value: string } | undefined;
};

type SessionVersionSource = {
  sessionVersion: number | null;
};

function normalizePositiveInteger(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseSessionVersion(value: unknown) {
  return normalizePositiveInteger(value);
}

export function getSessionVersionCookieValue(cookieStore: CookieLikeStore) {
  return parseSessionVersion(cookieStore.get(SESSION_VERSION_COOKIE)?.value);
}

export function isSessionStale(
  profile: SessionAwareProfile | null | undefined,
  { sessionVersion }: SessionVersionSource,
) {
  const profileVersion = parseSessionVersion(profile?.session_version);
  if (profileVersion == null) {
    return false;
  }

  return sessionVersion == null || sessionVersion !== profileVersion;
}

export function getSafeNextPath(
  next: string | null | undefined,
  fallback = "/auth/login",
) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function getSessionSignOutHref(nextPath = "/auth/login") {
  const safeNext = getSafeNextPath(nextPath);
  return `/auth/sign-out?next=${encodeURIComponent(safeNext)}&reason=session_replaced`;
}

export function setSessionVersionCookie(response: NextResponse, version: number) {
  response.cookies.set(SESSION_VERSION_COOKIE, String(version), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionVersionCookie(response: NextResponse) {
  response.cookies.set(SESSION_VERSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}

export function isSessionVersionSchemaError(error: SessionSchemaError | null | undefined) {
  if (!error) {
    return false;
  }

  if (error.code === "42703" || error.code === "42883") {
    return true;
  }

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("session_version") || message.includes("rotate_session_version");
}

function extractRotatedVersion(data: unknown) {
  const direct = parseSessionVersion(data);
  if (direct != null) {
    return direct;
  }

  if (data && typeof data === "object") {
    const candidate = data as Record<string, unknown>;
    return (
      parseSessionVersion(candidate.session_version) ??
      parseSessionVersion(candidate.version) ??
      parseSessionVersion(candidate.sessionVersion)
    );
  }

  return null;
}

type SessionRotationClient = {
  rpc(
    name: string,
    args: { profile_id: string },
  ): PromiseLike<{
    data: unknown;
    error: {
      message: string;
      code?: string | null;
    } | null;
  }>;
};

export async function rotateSessionVersionForUser(
  client: SessionRotationClient,
  profileId: string,
  response: NextResponse,
) {
  const { data, error } = await client.rpc("rotate_session_version", {
    profile_id: profileId,
  });

  if (error) {
    if (isSessionVersionSchemaError(error)) {
      setSessionVersionCookie(response, 1);
      return 1;
    }

    throw new Error(error.message);
  }

  const nextVersion = extractRotatedVersion(data);
  if (nextVersion == null) {
    throw new Error("rotate_session_version did not return a usable version.");
  }

  setSessionVersionCookie(response, nextVersion);
  return nextVersion;
}
