"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type CompetitionActionsProps = {
  deleteAction: () => Promise<void>;
  isPaused: boolean;
  togglePauseAction: () => Promise<void>;
};

export function CompetitionActions({
  deleteAction,
  isPaused,
  togglePauseAction,
}: CompetitionActionsProps) {
  const [isPausePending, startPauseTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        pending={isPausePending}
        pendingText={isPaused ? "Resuming..." : "Pausing..."}
        onClick={() => {
          startPauseTransition(async () => {
            await togglePauseAction();
          });
        }}
      >
        {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
        {isPaused ? "Resume" : "Force Pause"}
      </Button>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="gap-2"
        onClick={() => setIsDeleteOpen(true)}
      >
        <Trash2 className="size-4" />
        Delete Competition
      </Button>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete this competition?"
        description="This permanently removes the competition and its linked records. This action cannot be undone."
        confirmLabel="Delete competition"
        pending={isDeletePending}
        pendingLabel="Deleting..."
        onConfirm={() => {
          startDeleteTransition(async () => {
            await deleteAction();
          });
        }}
      />
    </>
  );
}
