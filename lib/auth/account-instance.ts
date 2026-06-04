"use client";

const ACCOUNT_INSTANCE_KEY_PREFIX = "centipede-account-instance:";
const ACCOUNT_INSTANCE_ID_KEY = "centipede-current-instance-id";
const ACCOUNT_INSTANCE_TTL_MS = 15_000;

type AccountInstanceRecord = {
  instanceId: string;
  expiresAt: number;
};

function getStorageSafe(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function setStorageSafe(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
  }
}

function removeStorageSafe(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
  }
}

function getAccountInstanceKey(userId: string) {
  return `${ACCOUNT_INSTANCE_KEY_PREFIX}${userId}`;
}

export function getCurrentAccountInstanceId() {
  const existing = getStorageSafe(window.sessionStorage, ACCOUNT_INSTANCE_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  setStorageSafe(window.sessionStorage, ACCOUNT_INSTANCE_ID_KEY, nextId);
  return nextId;
}

export function getAccountInstanceRecord(userId: string): AccountInstanceRecord | null {
  const raw = getStorageSafe(window.localStorage, getAccountInstanceKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AccountInstanceRecord>;
    if (typeof parsed.instanceId === "string" && typeof parsed.expiresAt === "number") {
      return {
        instanceId: parsed.instanceId,
        expiresAt: parsed.expiresAt,
      };
    }
  } catch {
  }

  return null;
}

export function isAccountOpenInAnotherInstance(userId: string, now = Date.now()) {
  const currentInstanceId = getCurrentAccountInstanceId();
  const record = getAccountInstanceRecord(userId);
  return Boolean(
    record
      && record.instanceId !== currentInstanceId
      && record.expiresAt > now,
  );
}

export function claimAccountInstance(userId: string, now = Date.now()) {
  const record: AccountInstanceRecord = {
    instanceId: getCurrentAccountInstanceId(),
    expiresAt: now + ACCOUNT_INSTANCE_TTL_MS,
  };

  setStorageSafe(window.localStorage, getAccountInstanceKey(userId), JSON.stringify(record));
  return record;
}

export function releaseAccountInstance(userId: string) {
  const currentInstanceId = getCurrentAccountInstanceId();
  const record = getAccountInstanceRecord(userId);
  if (!record || record.instanceId === currentInstanceId) {
    removeStorageSafe(window.localStorage, getAccountInstanceKey(userId));
  }
}
