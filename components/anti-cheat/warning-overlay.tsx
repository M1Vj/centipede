'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

type WarningOverlayPenalty = 'warning' | 'deduction' | 'auto_submit' | 'disqualified';

interface WarningOverlayProps {
  onAcknowledge: () => void;
  penalty: WarningOverlayPenalty | null;
}

const overlayCopy: Record<WarningOverlayPenalty, { title: string; message: string }> = {
  warning: {
    title: "Warning: Focus Lost",
    message:
      "This offense has been recorded. Additional focus-loss offenses may trigger score deductions, force submission, or disqualification.",
  },
  deduction: {
    title: "Deduction Applied",
    message: "This offense reached the deduction threshold. A point deduction has been applied to your score.",
  },
  auto_submit: {
    title: "Attempt Force-Submitted",
    message: "This offense reached the force-submit threshold. Your attempt has been submitted automatically.",
  },
  disqualified: {
    title: "Attempt Disqualified",
    message:
      "This offense reached the disqualification threshold. This competition attempt has been discarded, and you cannot attempt this competition again.",
  },
};

export function WarningOverlay({ onAcknowledge, penalty }: WarningOverlayProps) {
  if (!penalty) return null;

  const copy = overlayCopy[penalty];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-300 pointer-events-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="warning-overlay-title"
      aria-describedby="warning-overlay-desc"
    >
      <Card className="w-full max-w-lg shadow-2xl border-destructive/50 flex flex-col max-h-[100dvh]">
        <CardHeader className="text-center pb-2 shrink-0">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle id="warning-overlay-title" className="text-2xl font-bold text-destructive">
            {copy.title}
          </CardTitle>
        </CardHeader>
        <CardContent id="warning-overlay-desc" className="text-center space-y-4 pt-4 overflow-y-auto min-h-0">
          <p className="text-muted-foreground text-sm sm:text-base">
            You left the competition window. This has been recorded as a cheating offense.
          </p>
          
          <div className="p-4 bg-muted rounded-lg font-medium text-foreground text-sm sm:text-base border border-border/50">
            <span>{copy.message}</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 pt-6 shrink-0">
          {(penalty === 'warning' || penalty === 'deduction') ? (
            <Button
              className="w-full sm:w-auto font-semibold whitespace-normal h-auto min-h-11 sm:min-h-10 py-2 sm:px-6"
              size="lg"
              variant="destructive"
              onClick={onAcknowledge}
            >
              I Understand - Return to Competition
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto font-semibold whitespace-normal h-auto min-h-11 sm:min-h-10 py-2 sm:px-6"
              size="lg"
              variant="default"
              onClick={() => window.location.href = '/mathlete/competition'}
            >
              Return to Dashboard
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
