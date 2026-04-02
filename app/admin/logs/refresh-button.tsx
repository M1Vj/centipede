"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      pending={isPending}
      pendingText="Refreshing..."
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      {!isPending ? <Clock className="size-4" /> : null}
      Live Refresh
    </Button>
  );
}
