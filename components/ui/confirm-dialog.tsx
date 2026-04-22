"use client";

import type { ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmVariant?: "default" | "destructive";
  contentClassName?: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  overlayClassName?: string;
  open: boolean;
  pending?: boolean;
  pendingLabel?: string;
  title: string;
};

export function ConfirmDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  confirmDisabled = false,
  confirmVariant = "destructive",
  contentClassName,
  description,
  onConfirm,
  onOpenChange,
  overlayClassName,
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
        <AlertDialog.Overlay
          className={cn(
            "fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in",
            overlayClassName,
          )}
        />
        <AlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius)+0.45rem)] border border-border/70 bg-background/95 p-6 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)] outline-none transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
            contentClassName,
          )}
        >
          <div className="space-y-3">
            <AlertDialog.Title className="text-[1.45rem] font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" className="rounded-lg" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant={confirmVariant}
              className="rounded-lg"
              onClick={() => void onConfirm()}
              disabled={confirmDisabled}
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
