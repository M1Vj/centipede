"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  description: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending?: boolean;
  pendingLabel?: string;
  title: string;
};

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  confirmVariant = "destructive",
  description,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  pendingLabel,
  title,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending && !nextOpen) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[90] bg-foreground/25 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius)+0.5rem)] border border-border/70 bg-background/95 p-6 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
          <div className="space-y-3">
            <AlertDialog.Title className="text-2xl font-semibold text-foreground">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={() => void onConfirm()}
              pending={pending}
              pendingText={pendingLabel}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
