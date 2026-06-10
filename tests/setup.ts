import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class TestStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

if (typeof window !== "undefined") {
  if (!window.localStorage) {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: new TestStorage(),
    });
  }

  if (!window.sessionStorage) {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: new TestStorage(),
    });
  }
}

afterEach(() => {
  cleanup();
});
