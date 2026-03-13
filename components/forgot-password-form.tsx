"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { CircleAlert } from "lucide-react";
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setStatus({
      message: "Sending your reset link...",
      type: "pending",
    });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            Type in your email and we&apos;ll send you a link to reset your
            password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleForgotPassword}
            aria-busy={isLoading}
            aria-describedby={status.message ? statusId : undefined}
          >
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
                <FormStatusMessage
                  status={status.type}
                  message={status.message}
                  icon={status.type === "error" ? CircleAlert : undefined}
                />
              </div>
              <Button type="submit" className="w-full" pending={isLoading} pendingText="Sending...">
                Send reset email
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <ProgressLink href="/auth/login" className="underline underline-offset-4">
                Login
              </ProgressLink>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
