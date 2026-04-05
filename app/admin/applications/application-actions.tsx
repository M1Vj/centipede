"use client";

import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="default"
      className="w-full gap-2 shadow-sm"
      pending={pending}
      pendingText="Approving..."
    >
      <Check className="size-4" />
      Approve
    </Button>
  );
}

export function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full gap-2 text-destructive hover:bg-destructive/10"
      pending={pending}
      pendingText="Rejecting..."
    >
      <X className="size-4" />
      Reject
    </Button>
  );
}

export function RetryProvisioningButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      className="w-full gap-2 shadow-sm"
      pending={pending}
      pendingText="Retrying..."
    >
      <Check className="size-4" />
      Retry provisioning
    </Button>
  );
}
