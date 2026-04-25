"use client";

import type { ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  actionsClassName?: string;
  cancelLabel?: string;
  cancelClassName?: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmClassName?: string;
  confirmVariant?: "default" | "destructive";
  contentClassName?: string;
  description: string;
  descriptionClassName?: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  overlayClassName?: string;
  open: boolean;
  pending?: boolean;
  pendingLabel?: string;
  title: string;
  titleClassName?: string;
};

export function ConfirmDialog({
  actionsClassName,
  cancelLabel = "Cancel",
  cancelClassName,
  children,
  confirmLabel,
  confirmDisabled = false,
  confirmClassName,
  confirmVariant = "destructive",
  contentClassName,
  description,
  descriptionClassName,
  onConfirm,
  onOpenChange,
  overlayClassName,
  open,
  pending = false,
  pendingLabel,
  title,
  titleClassName,
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
            "fixed inset-0 z-[90] bg-slate-950/28 backdrop-blur-sm transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in",
            overlayClassName,
          )}
        />
        <AlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius)+0.45rem)] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-32px_rgba(15,23,42,0.28)] outline-none transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
            contentClassName,
          )}
        >
          <div className="space-y-3">
            <AlertDialog.Title
              className={cn(
                "text-[1.45rem] font-semibold leading-tight tracking-tight text-slate-900",
                titleClassName,
              )}
            >
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description
              className={cn("text-sm leading-6 text-slate-500", descriptionClassName)}
            >
              {description}
            </AlertDialog.Description>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}

          <div
            className={cn(
              "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
              actionsClassName,
            )}
          >
            <AlertDialog.Cancel asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "rounded-lg border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900",
                  cancelClassName,
                )}
                disabled={pending}
              >
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant={confirmVariant}
              className={cn("rounded-lg", confirmClassName)}
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
