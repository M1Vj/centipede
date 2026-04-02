"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { Button } from "@/components/ui/button";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { getErrorMessage } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";

const AUTO_REDIRECT_MS = 2000;

type PageStatus = {
  message: string;
  type: "error" | "pending" | "success";
};

async function resolvePostConfirmRedirect(userId: string) {
  const supabase = getSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !isProfileComplete(profile)) {
    return "/profile/complete";
  }

  if (profile.role === "admin") return "/admin";
  if (profile.role === "organizer") return "/organizer";
  return "/mathlete";
}

export function EmailConfirmedContent() {
  const feedbackRouter = useFeedbackRouter();
  const [status, setStatus] = useState<PageStatus>({
    message: "Confirming your email and preparing your session...",
    type: "pending",
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    async function confirm() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!user) {
          throw new Error(
            "We couldn't finish signing you in from the email link. Try logging in again."
          );
        }

        if (!active) return;

        setStatus({
          message: "Your email has been confirmed! Redirecting you now...",
          type: "success",
        });

        const target = await resolvePostConfirmRedirect(user.id);

        setTimeout(() => {
          if (active) feedbackRouter.replace(target);
        }, AUTO_REDIRECT_MS);
      } catch (error: unknown) {
        if (!active) return;

        setStatus({
          message: getErrorMessage(
            error,
            "We couldn't finish signing you in from the email link. Try logging in again."
          ),
          type: "error",
        });
      }
    }

    void confirm();

    return () => {
      active = false;
    };
  }, [feedbackRouter]);

  const statusIcon =
    status.type === "error"
      ? CircleAlert
      : status.type === "success"
        ? CircleCheck
        : undefined;

  return (
    <AuthShell
      eyebrow="Email confirmation"
      title={
        status.type === "success"
          ? "You're all set!"
          : "Finishing your sign-in"
      }
      description={
        status.type === "success"
          ? "Your email address has been verified. We're taking you to complete your profile."
          : "Mathwiz Arena is validating the email link and restoring your browser session before sending you onward."
      }
    >
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {status.type === "success"
                ? "Email confirmed!"
                : "Completing your email sign-in"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormStatusMessage
              status={status.type === "success" ? "success" : status.type}
              message={status.message}
              icon={statusIcon}
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
