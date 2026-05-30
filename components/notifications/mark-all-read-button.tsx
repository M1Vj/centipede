"use client";

import { Check, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

type MarkAllReadButtonProps = {
  allRead?: boolean;
} & Pick<ButtonProps, "className" | "disabled" | "size" | "variant">;

export function MarkAllReadButton({
  allRead = false,
  className,
  disabled,
  size,
  variant = "outline",
}: MarkAllReadButtonProps) {
  const { pending } = useFormStatus();
  const buttonLabel = pending ? "Marking..." : allRead ? "All read" : "Mark all read";
  const ariaLabel = allRead
    ? "All notifications are read"
    : "Mark all notifications as read";

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || allRead}
      pending={pending}
      pendingIndicator={<Loader2 className="size-4 animate-spin" />}
      pendingText={buttonLabel}
      aria-label={ariaLabel}
    >
      <Check className="size-4" />
      {buttonLabel}
    </Button>
  );
}
