import { act, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AntiCheatObserver, type PenaltyApplied } from "@/components/anti-cheat/anti-cheat-observer";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function renderObserver(options?: {
  isActive?: boolean;
  onPenalty?: (penalty: PenaltyApplied) => void;
  onSignal?: ComponentProps<typeof AntiCheatObserver>["onSignal"];
}) {
  const onPenalty = options?.onPenalty ?? vi.fn();
  render(
    <>
      <AntiCheatObserver
        attemptId="attempt-1"
        isActive={options?.isActive ?? true}
        onPenalty={onPenalty}
        onSignal={options?.onSignal}
      />
      <div data-testid="penalty-count">{vi.mocked(onPenalty).mock?.calls.length ?? 0}</div>
    </>,
  );

  return { onPenalty };
}

describe("AntiCheatObserver", () => {
  beforeEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ penaltyApplied: "deduction" }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  test("shows warning after sustained visible focus loss and sends keepalive offense request", async () => {
    vi.useFakeTimers();
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    window.dispatchEvent(new Event("blur"));

    expect(onPenalty).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(onPenalty).toHaveBeenCalledWith("warning");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );

    expect(onPenalty).toHaveBeenCalledWith("deduction");
  });

  test("does not call offense route when inactive", () => {
    const onPenalty = vi.fn();
    renderObserver({ isActive: false, onPenalty });

    window.dispatchEvent(new Event("blur"));

    expect(onPenalty).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("penalty-count")).toHaveTextContent("0");
  });

  test("logs one offense for a burst of away events", () => {
    vi.spyOn(Date, "now").mockReturnValue(10000);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("pagehide"));

    expect(onPenalty).toHaveBeenCalledWith("warning");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ body: expect.stringContaining("visibilitychange") }),
    );
  });

  test("queues hidden visibility transitions with sendBeacon when available", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(onPenalty).toHaveBeenCalledWith("warning");
    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.any(Blob),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("falls back to keepalive fetch when sendBeacon cannot queue hidden transitions", () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(sendBeacon).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.objectContaining({
        keepalive: true,
      }),
    );
  });

  test("logs pagehide immediately even when the document is still visible", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    window.dispatchEvent(new Event("pagehide"));

    expect(onPenalty).toHaveBeenCalledWith("warning");
    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.any(Blob),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("uses beacon on blur so early blur does not block unload-safe logging", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    window.dispatchEvent(new Event("blur"));
    expect(onPenalty).not.toHaveBeenCalled();

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onPenalty).toHaveBeenCalledWith("warning");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ignores transient visible blur when focus returns before the grace window", async () => {
    vi.useFakeTimers();
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(onPenalty).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("polling fallback does not log visible focus-only loss without a blur event", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onPenalty).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rearms after returning visible and logs a later away transition", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10000);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    nowSpy.mockReturnValue(16000);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onPenalty).toHaveBeenCalledTimes(2);
  });

  test("polling fallback logs when document becomes hidden without a visibility event", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: undefined,
    });
    const onPenalty = vi.fn();
    renderObserver({ onPenalty });

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onPenalty).toHaveBeenCalledWith("warning");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/anti-cheat/offense",
      expect.objectContaining({
        body: expect.stringContaining("visibility-poll"),
        keepalive: true,
      }),
    );
  });

  test("reports browser signal changes for live arena diagnostics", async () => {
    const onSignal = vi.fn();
    renderObserver({ onSignal });

    await waitFor(() => {
      expect(onSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          eventSource: "observer-ready",
          visibilityState: "visible",
          hidden: false,
        }),
      );
    });

    window.dispatchEvent(new Event("blur"));

    expect(onSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        eventSource: "blur",
        visibilityState: "visible",
      }),
    );
  });
});
