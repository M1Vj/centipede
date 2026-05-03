'use client'

import { useEffect, useEffectEvent, useRef } from 'react'

export type PenaltyApplied = 'warning' | 'deduction' | 'auto_submit' | 'disqualified' | 'none' | null
export type AntiCheatSignal = {
  eventSource: string;
  visibilityState: string;
  hidden: boolean;
  hasFocus: boolean;
  checkedAt: string;
}

type AntiCheatMetadata = {
  event_source: string;
  visibility_state: string;
  route_path: string;
  user_agent: string;
  client_timestamp: string | null;
}

interface AntiCheatObserverProps {
  attemptId: string;
  isActive: boolean;
  onPenalty: (penalty: PenaltyApplied) => void;
  onSignal?: (signal: AntiCheatSignal) => void;
  onEvent?: (event: {
    eventSource: string;
    visibilityState: string;
    status: "detected" | "sent" | "queued" | "error";
    penalty?: PenaltyApplied;
  }) => void;
}

export function AntiCheatObserver({ attemptId, isActive, onPenalty, onSignal, onEvent }: AntiCheatObserverProps) {
  const lastOffenseTime = useRef<number>(Number.NEGATIVE_INFINITY)
  const awayTransitionLogged = useRef(false)
  const DEDUPE_WINDOW_MS = 5000 // 5 seconds dedupe
  const SIGNAL_POLL_MS = 500
  const VISIBLE_BLUR_GRACE_MS = 1500
  const lastSignalKey = useRef<string | null>(null)
  const hasObservedFocus = useRef(false)
  const visibleBlurTimer = useRef<number | null>(null)
  const emitPenalty = useEffectEvent(onPenalty)
  const emitSignal = useEffectEvent((signal: AntiCheatSignal) => {
    onSignal?.(signal)
  })
  const emitEvent = useEffectEvent(
    (event: {
      eventSource: string;
      visibilityState: string;
      status: "detected" | "sent" | "queued" | "error";
      penalty?: PenaltyApplied;
    }) => {
      onEvent?.(event)
    },
  )

  useEffect(() => {
    if (!isActive) return

    awayTransitionLogged.current = false
    hasObservedFocus.current = !document.hidden

    const readSignal = (eventSource: string) => ({
      eventSource,
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : true,
      checkedAt: new Date().toISOString(),
    })

    const publishSignal = (eventSource: string, options?: { force?: boolean }) => {
      const signal = readSignal(eventSource)
      if (signal.hasFocus) {
        hasObservedFocus.current = true
      }
      const signalKey = `${signal.visibilityState}:${signal.hidden}:${signal.hasFocus}`
      if (options?.force || lastSignalKey.current !== signalKey) {
        lastSignalKey.current = signalKey
        emitSignal(signal)
      }
      return signal
    }

    const cancelVisibleBlurTimer = () => {
      if (visibleBlurTimer.current !== null) {
        window.clearTimeout(visibleBlurTimer.current)
        visibleBlurTimer.current = null
      }
    }

    const handleFocusLoss = async (
      eventSource: string,
      visibilityState: string,
      options?: { useBeacon?: boolean },
    ) => {
      cancelVisibleBlurTimer()
      if (awayTransitionLogged.current) {
        return
      }

      const now = Date.now()
      if (now - lastOffenseTime.current < DEDUPE_WINDOW_MS) {
        return // Ignore rapid successive events
      }
      lastOffenseTime.current = now
      awayTransitionLogged.current = true
      emitEvent({
        eventSource,
        visibilityState,
        status: "detected",
      })
      emitPenalty('warning')

      const metadata: AntiCheatMetadata = {
        event_source: eventSource,
        visibility_state: visibilityState,
        route_path: window.location.pathname,
        user_agent: window.navigator.userAgent,
        client_timestamp: new Date().toISOString()
      }

      const body = JSON.stringify({
        attemptId,
        metadata,
      })

      if (options?.useBeacon && typeof window.navigator.sendBeacon === 'function') {
        const queued = window.navigator.sendBeacon(
          '/api/anti-cheat/offense',
          new Blob([body], { type: 'application/json' }),
        )

        if (queued) {
          emitEvent({
            eventSource,
            visibilityState,
            status: "queued",
          })
          return
        }
      }

      try {
        const res = await fetch('/api/anti-cheat/offense', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body,
          keepalive: true,
        })

        if (!res.ok) {
          console.error('Failed to log anti-cheat offense:', res.status)
          return
        }

        const payload = (await res.json()) as { penaltyApplied?: PenaltyApplied }
        emitEvent({
          eventSource,
          visibilityState,
          status: "sent",
          penalty: payload.penaltyApplied ?? "none",
        })
        if (payload.penaltyApplied && payload.penaltyApplied !== 'none') {
          emitPenalty(payload.penaltyApplied)
        }
      } catch (error) {
        emitEvent({
          eventSource,
          visibilityState,
          status: "error",
        })
        console.error(
          'Failed to log anti-cheat offense:',
          error instanceof Error ? error.message : 'unknown_error',
        )
      }
    }

    const scheduleVisibleBlurCheck = () => {
      if (visibleBlurTimer.current !== null) {
        return
      }

      visibleBlurTimer.current = window.setTimeout(() => {
        visibleBlurTimer.current = null
        const currentSignal = publishSignal('blur-grace', { force: true })
        if (currentSignal.hidden) {
          void handleFocusLoss('visibilitychange', currentSignal.visibilityState, { useBeacon: true })
          return
        }

        if (!currentSignal.hasFocus) {
          void handleFocusLoss('blur', currentSignal.visibilityState, { useBeacon: true })
        }
      }, VISIBLE_BLUR_GRACE_MS)
    }

    const onVisibilityChange = () => {
      const signal = publishSignal('visibilitychange', { force: true })
      if (signal.hidden) {
        void handleFocusLoss('visibilitychange', signal.visibilityState, { useBeacon: true })
      } else {
        cancelVisibleBlurTimer()
        awayTransitionLogged.current = false
      }
    }

    const onBlur = () => {
      const signal = publishSignal('blur', { force: true })
      if (signal.hidden) {
        void handleFocusLoss('blur', signal.visibilityState, { useBeacon: true })
        return
      }

      scheduleVisibleBlurCheck()
    }

    const onPageHide = () => {
      const signal = publishSignal('pagehide', { force: true })
      void handleFocusLoss('pagehide', signal.visibilityState, {
        useBeacon: true,
      })
    }

    const onFocusReturn = () => {
      cancelVisibleBlurTimer()
      publishSignal('focus', { force: true })
      awayTransitionLogged.current = false
    }

    const signalPollId = window.setInterval(() => {
      const signal = publishSignal('poll')
      if (signal.hidden) {
        void handleFocusLoss('visibility-poll', signal.visibilityState, {
          useBeacon: true,
        })
      } else if (signal.hasFocus || hasObservedFocus.current) {
        if (signal.hasFocus) {
          cancelVisibleBlurTimer()
        }
        awayTransitionLogged.current = false
      }
    }, SIGNAL_POLL_MS)

    publishSignal('observer-ready', { force: true })

    const listenerOptions = { capture: true }
    document.addEventListener('visibilitychange', onVisibilityChange, listenerOptions)
    document.addEventListener('freeze', onPageHide, listenerOptions)
    window.addEventListener('blur', onBlur, listenerOptions)
    window.addEventListener('focus', onFocusReturn, listenerOptions)
    window.addEventListener('pagehide', onPageHide, listenerOptions)
    window.addEventListener('pageshow', onFocusReturn, listenerOptions)

    return () => {
      cancelVisibleBlurTimer()
      window.clearInterval(signalPollId)
      document.removeEventListener('visibilitychange', onVisibilityChange, listenerOptions)
      document.removeEventListener('freeze', onPageHide, listenerOptions)
      window.removeEventListener('blur', onBlur, listenerOptions)
      window.removeEventListener('focus', onFocusReturn, listenerOptions)
      window.removeEventListener('pagehide', onPageHide, listenerOptions)
      window.removeEventListener('pageshow', onFocusReturn, listenerOptions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effect lifetime follows attempt activation; useEffectEvent callbacks always read latest props.
  }, [attemptId, isActive])

  return null
}
