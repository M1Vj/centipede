import { act, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TabSwitchWarningObserver,
  type TabSwitchSignal,
} from "@/components/arena/tab-switch-warning-observer";

function renderObserver(options?: {
  isActive?: boolean;
  onWarning?: () => void;
  onSignal?: ComponentProps<typeof TabSwitchWarningObserver>["onSignal"];
}) {
  const onWarning = options?.onWarning ?? vi.fn();
  render(
    <TabSwitchWarningObserver
      isActive={options?.isActive ?? true}
      onWarning={onWarning}
      onSignal={options?.onSignal}
    />,
  );

  return { onWarning };
}

describe("TabSwitchWarningObserver", () => {
  beforeEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  test("does not warn when inactive", () => {
    const onWarning = vi.fn();
    renderObserver({ isActive: false, onWarning });

    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onWarning).not.toHaveBeenCalled();
  });

  test("warns after sustained visible focus loss", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const onWarning = vi.fn();
    renderObserver({ onWarning });

    window.dispatchEvent(new Event("blur"));

    expect(onWarning).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  test("warns immediately when the tab becomes hidden", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const onWarning = vi.fn();
    renderObserver({ onWarning });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  test("ignores transient blur when focus returns before the grace window", async () => {
    vi.useFakeTimers();
    const hasFocus = vi.spyOn(document, "hasFocus");
    hasFocus.mockReturnValueOnce(true).mockReturnValue(false).mockReturnValue(true);
    const onWarning = vi.fn();
    renderObserver({ onWarning });

    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(onWarning).not.toHaveBeenCalled();
  });

  test("emits local visibility signals without logging to an API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const signals: TabSwitchSignal[] = [];
    renderObserver({ onSignal: (signal) => signals.push(signal) });

    expect(signals[0]).toEqual(expect.objectContaining({ eventSource: "observer-ready" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
