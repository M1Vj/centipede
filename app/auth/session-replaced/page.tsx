"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { getSafeNextPath } from "@/lib/auth/session";

export default function SessionReplacedPage() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  const nextPath = useMemo(
    () => getSafeNextPath(searchParams.get("next"), "/auth/login"),
    [searchParams],
  );

  const action = useMemo(
    () => `/auth/sign-out?next=${encodeURIComponent(nextPath)}`,
    [nextPath],
  );

  useEffect(() => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <AuthShell
      eyebrow="Session update"
      title="Your account was signed in from another session"
      description="For security, we need to refresh your session before continuing. You will be redirected to login automatically."
    >
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
          If this page does not redirect automatically, continue manually.
        </div>
        <form ref={formRef} method="post" action={action}>
          <Button type="submit" className="w-full">
            Continue to login
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
