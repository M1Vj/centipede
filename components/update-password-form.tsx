"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { CircleAlert } from "lucide-react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{
    message: string | null;
    type: "error" | "pending";
  }>({
    message: null,
    type: "pending",
  });
  const [isLoading, setIsLoading] = useState(false);
  const feedbackRouter = useFeedbackRouter();
  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setStatus({
      message: "Saving your new password...",
      type: "pending",
    });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      feedbackRouter.push("/protected");
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : "An error occurred",
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
            Please enter your new password below.
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
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
                <FormStatusMessage
                  status={status.type}
                  message={status.message}
                  icon={status.type === "error" ? CircleAlert : undefined}
                />
              </div>
              <Button type="submit" className="w-full" pending={isLoading} pendingText="Saving...">
                Save new password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
