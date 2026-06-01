"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface TabSwitchWarningOverlayProps {
  open: boolean;
  onAcknowledge: () => void;
}

export function TabSwitchWarningOverlay({
  open,
  onAcknowledge,
}: TabSwitchWarningOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300 sm:p-8"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="tab-switch-warning-title"
      aria-describedby="tab-switch-warning-desc"
    >
      <Card className="flex max-h-[100dvh] w-full max-w-lg flex-col border-amber-300 shadow-2xl">
        <CardHeader className="shrink-0 pb-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-6 w-6 text-amber-700" aria-hidden="true" />
          </div>
          <CardTitle id="tab-switch-warning-title" className="text-2xl font-bold text-amber-900">
            Warning: Focus Lost
          </CardTitle>
        </CardHeader>
        <CardContent id="tab-switch-warning-desc" className="min-h-0 space-y-4 overflow-y-auto pt-4 text-center">
          <p className="text-sm text-muted-foreground sm:text-base">
            You left the competition window.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950 sm:text-base">
            Stay on the competition tab while answering. Your timer continues to run while this warning is visible.
          </div>
        </CardContent>
        <CardFooter className="flex shrink-0 justify-center gap-3 pt-6">
          <Button
            className="h-auto min-h-11 w-full whitespace-normal py-2 font-semibold sm:w-auto sm:min-h-10 sm:px-6"
            size="lg"
            onClick={onAcknowledge}
          >
            I Understand - Return to Competition
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
