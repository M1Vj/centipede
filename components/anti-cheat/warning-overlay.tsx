'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface WarningOverlayProps {
  onAcknowledge: () => void;
  penalty: 'warning' | 'deduction' | 'auto_submit' | 'disqualified' | null;
}

export function WarningOverlay({ onAcknowledge, penalty }: WarningOverlayProps) {
  if (!penalty) return null;

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
            Warning: Focus Lost
          </CardTitle>
        </CardHeader>
        <CardContent id="warning-overlay-desc" className="text-center space-y-4 pt-4 overflow-y-auto min-h-0">
          <p className="text-muted-foreground text-sm sm:text-base">
            You left the competition window. This has been recorded as a cheating offense.
          </p>
          
          <div className="p-4 bg-muted rounded-lg font-medium text-foreground text-sm sm:text-base border border-border/50">
            {penalty === 'warning' && (
              <span>This is a final warning. Additional offenses will result in score deductions or disqualification.</span>
            )}
            {penalty === 'deduction' && (
              <span>A point deduction has been applied to your score for this offense.</span>
            )}
            {(penalty === 'auto_submit' || penalty === 'disqualified') && (
              <span>Your attempt has been forcefully ended due to repeated offenses.</span>
            )}
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
              I Understand – Return to Competition
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
