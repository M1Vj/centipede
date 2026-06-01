"use client";

import { useEffect, useEffectEvent, useRef } from "react";

export type TabSwitchSignal = {
  eventSource: string;
  visibilityState: string;
  hidden: boolean;
  hasFocus: boolean;
  checkedAt: string;
};

interface TabSwitchWarningObserverProps {
  isActive: boolean;
  onWarning: () => void;
  onSignal?: (signal: TabSwitchSignal) => void;
}

export function TabSwitchWarningObserver({
  isActive,
  onWarning,
  onSignal,
}: TabSwitchWarningObserverProps) {
  const awayTransitionWarned = useRef(false);
  const visibleBlurTimer = useRef<number | null>(null);
  const lastSignalKey = useRef<string | null>(null);
  const hasObservedFocus = useRef(false);
  const SIGNAL_POLL_MS = 500;
  const VISIBLE_BLUR_GRACE_MS = 1500;
  const emitWarning = useEffectEvent(onWarning);
  const emitSignal = useEffectEvent((signal: TabSwitchSignal) => {
    onSignal?.(signal);
  });

  useEffect(() => {
    if (!isActive) {
      return;
    }

    awayTransitionWarned.current = false;
    hasObservedFocus.current = !document.hidden;

    const readSignal = (eventSource: string): TabSwitchSignal => ({
      eventSource,
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : true,
      checkedAt: new Date().toISOString(),
    });

    const publishSignal = (eventSource: string, options?: { force?: boolean }) => {
      const signal = readSignal(eventSource);
      if (signal.hasFocus) {
        hasObservedFocus.current = true;
      }
      const signalKey = `${signal.visibilityState}:${signal.hidden}:${signal.hasFocus}`;
      if (options?.force || lastSignalKey.current !== signalKey) {
        lastSignalKey.current = signalKey;
        emitSignal(signal);
      }
      return signal;
    };

    const cancelVisibleBlurTimer = () => {
      if (visibleBlurTimer.current !== null) {
        window.clearTimeout(visibleBlurTimer.current);
        visibleBlurTimer.current = null;
      }
    };

    const warnOnceForAwayTransition = () => {
      cancelVisibleBlurTimer();
      if (awayTransitionWarned.current) {
        return;
      }
      awayTransitionWarned.current = true;
      emitWarning();
    };

    const scheduleVisibleBlurCheck = () => {
      if (visibleBlurTimer.current !== null) {
        return;
      }

      visibleBlurTimer.current = window.setTimeout(() => {
        visibleBlurTimer.current = null;
        const currentSignal = publishSignal("blur-grace", { force: true });
        if (currentSignal.hidden || !currentSignal.hasFocus) {
          warnOnceForAwayTransition();
        }
      }, VISIBLE_BLUR_GRACE_MS);
    };

    const onVisibilityChange = () => {
      const signal = publishSignal("visibilitychange", { force: true });
      if (signal.hidden) {
        warnOnceForAwayTransition();
      } else {
        cancelVisibleBlurTimer();
        awayTransitionWarned.current = false;
      }
    };

    const onBlur = () => {
      const signal = publishSignal("blur", { force: true });
      if (signal.hidden) {
        warnOnceForAwayTransition();
        return;
      }

      scheduleVisibleBlurCheck();
    };

    const onPageHide = () => {
      publishSignal("pagehide", { force: true });
      warnOnceForAwayTransition();
    };

    const onFocusReturn = () => {
      cancelVisibleBlurTimer();
      publishSignal("focus", { force: true });
      awayTransitionWarned.current = false;
    };

    const signalPollId = window.setInterval(() => {
      const signal = publishSignal("poll");
      if (signal.hidden) {
        warnOnceForAwayTransition();
      } else if (signal.hasFocus || hasObservedFocus.current) {
        if (signal.hasFocus) {
          cancelVisibleBlurTimer();
        }
        awayTransitionWarned.current = false;
      }
    }, SIGNAL_POLL_MS);

    publishSignal("observer-ready", { force: true });

    const listenerOptions = { capture: true };
    document.addEventListener("visibilitychange", onVisibilityChange, listenerOptions);
    document.addEventListener("freeze", onPageHide, listenerOptions);
    window.addEventListener("blur", onBlur, listenerOptions);
    window.addEventListener("focus", onFocusReturn, listenerOptions);
    window.addEventListener("pagehide", onPageHide, listenerOptions);
    window.addEventListener("pageshow", onFocusReturn, listenerOptions);

    return () => {
      cancelVisibleBlurTimer();
      window.clearInterval(signalPollId);
      document.removeEventListener("visibilitychange", onVisibilityChange, listenerOptions);
      document.removeEventListener("freeze", onPageHide, listenerOptions);
      window.removeEventListener("blur", onBlur, listenerOptions);
      window.removeEventListener("focus", onFocusReturn, listenerOptions);
      window.removeEventListener("pagehide", onPageHide, listenerOptions);
      window.removeEventListener("pageshow", onFocusReturn, listenerOptions);
    };
  }, [emitSignal, emitWarning, isActive]);

  return null;
}
