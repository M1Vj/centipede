"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type DisputeDialogProps = {
  competitionId: string;
  competitionProblemId: string;
  attemptId: string;
  orderIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
};

export function DisputeDialog({
  competitionId,
  competitionProblemId,
  attemptId,
  orderIndex,
  open,
  onOpenChange,
  onSubmitted,
}: DisputeDialogProps) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedReason = reason.trim();

  async function submitDispute() {
    if (pending || trimmedReason.length < 12) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/mathlete/competition/${competitionId}/disputes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attemptId,
          competitionProblemId,
          reason: trimmedReason,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message ?? "Dispute could not be submitted.");
        return;
      }

      setReason("");
      onSubmitted();
      onOpenChange(false);
    } catch {
      setError("Dispute could not be submitted. Check connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute problem {orderIndex}</DialogTitle>
          <DialogDescription>
            New disputes start open. Organizers move them through reviewing, then accepted, rejected, or resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor={`dispute-reason-${competitionProblemId}`}>Dispute reason</Label>
          <textarea
            id={`dispute-reason-${competitionProblemId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
            maxLength={800}
          />
          <p className="text-xs text-slate-500">{trimmedReason.length}/800 characters</p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#f49700] text-white hover:bg-[#df8800]"
            onClick={() => void submitDispute()}
            disabled={trimmedReason.length < 12}
            pending={pending}
            pendingText="Submitting"
          >
            Submit dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
