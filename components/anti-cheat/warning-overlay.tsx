'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface WarningOverlayProps {
  onAcknowledge: () => void;
  penalty: 'warning' | 'deduction' | 'auto_submit' | 'disqualified' | null;
}

export function WarningOverlay({ onAcknowledge, penalty }: WarningOverlayProps) {
  if (!penalty || penalty === 'none') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl border-destructive/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            Warning: Focus Lost
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-4">
          <p className="text-muted-foreground">
            You left the competition window. This has been recorded as a cheating offense.
          </p>
          
          <div className="p-4 bg-muted rounded-lg font-medium text-foreground">
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
        <CardFooter className="flex justify-center pt-6">
          {(penalty === 'warning' || penalty === 'deduction') ? (
            <Button
              className="w-full sm:w-auto font-semibold"
              size="lg"
              variant="destructive"
              onClick={onAcknowledge}
            >
              I Understand – Return to Competition
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto font-semibold"
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
