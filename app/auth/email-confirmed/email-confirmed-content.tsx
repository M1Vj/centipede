"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { Button } from "@/components/ui/button";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { resolveEmailConfirmationRedirect } from "@/lib/auth/email-confirmation";
import { getErrorMessage } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabaseClient";

const fallbackMessage =
  "We couldn't finish signing you in from the email link. Try logging in again.";

export function EmailConfirmedContent() {
  const feedbackRouter = useFeedbackRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [status, setStatus] = useState<{
    message: string;
    type: "error" | "pending";
  }>({
    message: "Confirming your email and preparing your session...",
    type: "pending",
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    const completeRedirect = async () => {
      try {
        const target = await resolveEmailConfirmationRedirect({
          client: supabase,
          next,
        });

        if (!active) {
          return;
        }

        feedbackRouter.replace(target);
      } catch (error: unknown) {
        if (!active) {
          return;
        }

        setStatus({
          message: getErrorMessage(error, fallbackMessage),
          type: "error",
        });
      }
    };

    const timer = window.setTimeout(() => {
      void completeRedirect();
    }, 250);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) {
        return;
      }

      const safeNext = next?.startsWith("/") ? next : "/";
      feedbackRouter.replace(safeNext);
    });

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [feedbackRouter, next]);

  return (
    <AuthShell
      eyebrow="Email confirmation"
      title="Finishing your sign-in"
      description="Mathwiz Arena is validating the email link and restoring your browser session before sending you onward."
    >
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Completing your email sign-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormStatusMessage
              status={status.type}
              message={status.message}
              icon={status.type === "error" ? CircleAlert : undefined}
            />
            {status.type === "error" ? (
              <Button asChild variant="outline" className="w-full">
                <ProgressLink href="/auth/login">Return to login</ProgressLink>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
