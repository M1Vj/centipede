import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SafeExamBrowserMode } from "@/lib/scoring/types";

const CONFIG_KEY_HEADER = "x-safeexambrowser-configkeyhash";
const REQUEST_HASH_HEADER = "x-safeexambrowser-requesthash";

export function getSafeExamBrowserHeaders(request: Request) {
  return {
    configKeyHash: request.headers.get(CONFIG_KEY_HEADER)?.trim().toLowerCase() ?? null,
    requestHash: request.headers.get(REQUEST_HASH_HEADER)?.trim().toLowerCase() ?? null,
  };
}

export function isSafeExamBrowserConfigAllowed(input: {
  mode: SafeExamBrowserMode;
  allowedConfigKeyHashes: string[];
  request: Request;
}) {
  if (input.mode !== "required") {
    return true;
  }

  return verifySafeExamBrowserRequest(input.request, input.allowedConfigKeyHashes);
}

type SafeExamBrowserPolicy = {
  mode: SafeExamBrowserMode;
  configKeyHashes: string[];
};

type SafeExamBrowserGateResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function normalizeMode(value: unknown): SafeExamBrowserMode {
  return value === "off" || value === "required"
    ? value
    : "off";
}

function normalizeHashes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, entries) => /^[a-f0-9]{64}$/.test(entry) && entries.indexOf(entry) === index);
}

function isMissingSafeExamBrowserColumn(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("safe_exam_browser_mode") ||
    message.includes("safe_exam_browser_config_key_hashes")
  );
}

export function buildSafeExamBrowserRequestHash(url: string, configKeyHash: string) {
  const absoluteUrl = new URL(url);
  absoluteUrl.hash = "";

  return createHash("sha256")
    .update(`${absoluteUrl.toString()}${configKeyHash.toLowerCase()}`)
    .digest("hex");
}

export function verifySafeExamBrowserRequest(request: Request, configKeyHashes: string[]) {
  const { configKeyHash } = getSafeExamBrowserHeaders(request);
  if (!configKeyHash || !/^[a-f0-9]{64}$/.test(configKeyHash)) {
    return false;
  }

  return configKeyHashes.some(
    (allowedConfigKeyHash) => buildSafeExamBrowserRequestHash(request.url, allowedConfigKeyHash) === configKeyHash,
  );
}

async function loadSafeExamBrowserPolicy(competitionId: string): Promise<SafeExamBrowserPolicy | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("competitions")
    .select("safe_exam_browser_mode, safe_exam_browser_config_key_hashes")
    .eq("id", competitionId)
    .maybeSingle();

  if (error) {
    if (isMissingSafeExamBrowserColumn(error)) {
      return null;
    }

    throw error;
  }

  return {
    mode: normalizeMode(data?.safe_exam_browser_mode),
    configKeyHashes: normalizeHashes(data?.safe_exam_browser_config_key_hashes),
  };
}

export async function requireSafeExamBrowserForAttemptStart(
  request: Request,
  competitionId: string,
): Promise<SafeExamBrowserGateResult> {
  const policy = await loadSafeExamBrowserPolicy(competitionId);
  if (!policy || policy.mode !== "required") {
    return { ok: true };
  }

  if (policy.configKeyHashes.length === 0) {
    return {
      ok: false,
      code: "safe_exam_browser_not_configured",
      message: "This competition requires Safe Exam Browser, but organizer configuration is incomplete.",
    };
  }

  if (!verifySafeExamBrowserRequest(request, policy.configKeyHashes)) {
    return {
      ok: false,
      code: "safe_exam_browser_required",
      message: "This competition requires Safe Exam Browser.",
    };
  }

  return { ok: true };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSafeExamBrowserConfig(input: {
  startUrl: string;
  quitUrl: string;
  allowedUrlOrigin: string;
}) {
  const startUrl = escapeXml(input.startUrl);
  const quitUrl = escapeXml(input.quitUrl);
  const origin = escapeXml(input.allowedUrlOrigin.replace(/\/$/, ""));

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key>
  <string>${startUrl}</string>
  <key>quitURL</key>
  <string>${quitUrl}</string>
  <key>sendBrowserExamKey</key>
  <true/>
  <key>URLFilterEnable</key>
  <true/>
  <key>URLFilterEnableContentFilter</key>
  <true/>
  <key>URLFilterRules</key>
  <array>
    <dict>
      <key>active</key>
      <true/>
      <key>action</key>
      <integer>1</integer>
      <key>expression</key>
      <string>${origin}/*</string>
      <key>regex</key>
      <false/>
    </dict>
  </array>
  <key>allowQuit</key>
  <true/>
  <key>browserWindowAllowReload</key>
  <false/>
  <key>enableAltTab</key>
  <false/>
  <key>enableAltF4</key>
  <false/>
  <key>enableCtrlEsc</key>
  <false/>
  <key>enableEsc</key>
  <false/>
  <key>enableF11</key>
  <false/>
  <key>enableF12</key>
  <false/>
  <key>enablePrintScreen</key>
  <false/>
  <key>enableRightMouse</key>
  <false/>
  <key>allowDisplayMirroring</key>
  <false/>
  <key>allowedDisplaysMaxNumber</key>
  <integer>1</integer>
</dict>
</plist>
`;
}
