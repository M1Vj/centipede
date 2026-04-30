'use client'

import { useEffect, useRef } from 'react'
import { logTabSwitchOffenseAction, AntiCheatMetadata } from '@/lib/anti-cheat/actions'

export type PenaltyApplied = 'warning' | 'deduction' | 'auto_submit' | 'disqualified' | 'none' | null

interface AntiCheatObserverProps {
  attemptId: string;
  isActive: boolean;
  onPenalty: (penalty: PenaltyApplied) => void;
}

export function AntiCheatObserver({ attemptId, isActive, onPenalty }: AntiCheatObserverProps) {
  const lastOffenseTime = useRef<number>(0)
  const DEDUPE_WINDOW_MS = 5000 // 5 seconds dedupe

  useEffect(() => {
    if (!isActive) return

    const handleFocusLoss = async (eventSource: string, visibilityState: string) => {
      const now = Date.now()
      if (now - lastOffenseTime.current < DEDUPE_WINDOW_MS) {
        return // Ignore rapid successive events
      }
      lastOffenseTime.current = now

      const metadata: AntiCheatMetadata = {
        event_source: eventSource,
        visibility_state: visibilityState,
        route_path: window.location.pathname,
        user_agent: window.navigator.userAgent,
        client_timestamp: new Date().toISOString()
      }

      const res = await logTabSwitchOffenseAction(attemptId, metadata)
      if (res && res.penaltyApplied) {
        onPenalty(res.penaltyApplied as PenaltyApplied)
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLoss('visibilitychange', 'hidden')
      }
    }

    const onBlur = () => {
      // document.hidden might not be true if just losing focus to another window
      handleFocusLoss('blur', document.hidden ? 'hidden' : 'visible')
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [attemptId, isActive, onPenalty])

  return null
}
