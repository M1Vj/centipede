"use client";

import { useState } from "react";
import { CircleAlert, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { getErrorMessage } from "@/lib/errors";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{
    message: string | null;
    type: "error" | "pending" | "success";
  }>({
    message: null,
    type: "pending",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    setIsLoading(true);
    setStatus({
      message: "Sending your reset link...",
      type: "pending",
    });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) {
        throw error;
      }

      setStatus({
        message:
          "If you registered with email and password, your password reset instructions are on the way.",
        type: "success",
      });
    } catch (error: unknown) {
      setStatus({
        message: getErrorMessage(error, "An error occurred"),
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("space-y-5", className)} {...props}>
      <form
        onSubmit={handleForgotPassword}
        className="space-y-4"
        aria-busy={isLoading}
        aria-describedby={status.message ? statusId : undefined}
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-14 rounded-xl border-input bg-background/80 pl-11 text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={status.type}
            message={status.message}
            icon={status.type === "error" ? CircleAlert : undefined}
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[#f49701] text-base font-semibold text-[#111827] hover:bg-[#df8e00]"
          pending={isLoading}
          pendingText="Sending..."
        >
          Send reset email
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <ProgressLink
          href="/auth/login"
          className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Login
        </ProgressLink>
      </p>
    </div>
  );
}
