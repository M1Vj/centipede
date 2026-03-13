"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type NavigationFeedbackContextValue = {
  completeNavigation: () => void;
  isNavigating: boolean;
  startNavigation: () => void;
};

const NavigationFeedbackContext =
  createContext<NavigationFeedbackContextValue | null>(null);

const SHOW_DELAY_MS = 120;
const MIN_VISIBLE_MS = 240;
const FINISH_DURATION_MS = 240;

function RouteProgressBar({
  isFinishing,
  visible,
}: {
  isFinishing: boolean;
  visible: boolean;
}) {
  if (!visible && !isFinishing) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden">
      <div
        className={cn(
          "h-full bg-primary shadow-[0_0_24px_hsl(var(--primary)/0.7)]",
          isFinishing
            ? "w-full opacity-0 transition-[width,opacity] duration-200"
            : "route-progress-active",
        )}
      />
    </div>
  );
}

export function NavigationFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const shownAtRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  const finishNow = useCallback(() => {
    clearTimers();
    setIsNavigating(false);
    setIsFinishing(true);
    finishTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setIsFinishing(false);
      shownAtRef.current = null;
      finishTimerRef.current = null;
    }, FINISH_DURATION_MS);
  }, [clearTimers]);

  const completeNavigation = useCallback(() => {
    if (!isNavigating) {
      return;
    }

    if (!visible) {
      clearTimers();
      setIsNavigating(false);
      return;
    }

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : 0;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);

    clearTimers();
    finishTimerRef.current = window.setTimeout(finishNow, remaining);
  }, [clearTimers, finishNow, isNavigating, visible]);

  const startNavigation = useCallback(() => {
    if (isNavigating) {
      return;
    }

    clearTimers();
    setIsNavigating(true);
    setIsFinishing(false);
    showTimerRef.current = window.setTimeout(() => {
      shownAtRef.current = Date.now();
      setVisible(true);
      showTimerRef.current = null;
    }, SHOW_DELAY_MS);
  }, [clearTimers, isNavigating]);

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers],
  );

  const value = useMemo(
    () => ({
      completeNavigation,
      isNavigating,
      startNavigation,
    }),
    [completeNavigation, isNavigating, startNavigation],
  );

  return (
    <NavigationFeedbackContext.Provider value={value}>
      <Suspense fallback={null}>
        <NavigationFeedbackWatcher onNavigationChange={completeNavigation} />
      </Suspense>
      <RouteProgressBar visible={visible} isFinishing={isFinishing} />
      {children}
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  const context = useContext(NavigationFeedbackContext);

  if (!context) {
    throw new Error(
      "useNavigationFeedback must be used within a NavigationFeedbackProvider.",
    );
  }

  return context;
}

function NavigationFeedbackWatcher({
  onNavigationChange,
}: {
  onNavigationChange: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    onNavigationChange();
  }, [pathname, search, onNavigationChange]);

  return null;
}
