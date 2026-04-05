"use client";

import { FormEvent, useState } from "react";
import { CircleAlert, CircleCheck, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";

type LookupPayload = {
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  maskedContactEmail: string;
};

type StatusLookupProps = {
  initialToken: string;
};

export function OrganizerStatusLookup({ initialToken }: StatusLookupProps) {
  const [token, setToken] = useState(initialToken);
  const [isLoading, setIsLoading] = useState(false);
  const [payload, setPayload] = useState<LookupPayload | null>(null);
  const [status, setStatus] = useState<{
    type: "error" | "pending" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setStatus({
        type: "error",
        message: "Enter your secure status token.",
      });
      return;
    }

    setIsLoading(true);
    setPayload(null);
    setStatus({
      type: "pending",
      message: "Checking organizer application status...",
    });

    try {
      const response = await fetch(
        `/api/organizer/status?token=${encodeURIComponent(trimmedToken)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const json = (await response.json()) as {
        code?: string;
        status?: "pending" | "approved" | "rejected";
        rejectionReason?: string | null;
        maskedContactEmail?: string;
        message?: string;
      };

      if (response.status === 429 || json.code === "throttled") {
        setStatus({
          type: "error",
          message: "Too many lookup attempts. Please wait one second and try again.",
        });
        setIsLoading(false);
        return;
      }

      if (!response.ok || json.code === "not_found") {
        setStatus({
          type: "error",
          message:
            "Status token not found. Verify your token and try again.",
        });
        setIsLoading(false);
        return;
      }

      if (!json.status || !json.maskedContactEmail) {
        setStatus({
          type: "error",
          message: "Unexpected response while looking up organizer status.",
        });
        setIsLoading(false);
        return;
      }

      setPayload({
        status: json.status,
        rejectionReason: json.rejectionReason ?? null,
        maskedContactEmail: json.maskedContactEmail,
      });

      setStatus({
        type: "success",
        message: "Organizer status loaded.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Unable to check status right now. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Secure status lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={isLoading}>
            <div className="grid gap-2">
              <Label htmlFor="statusToken">Status token</Label>
              <Input
                id="statusToken"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste your organizer status token"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" pending={isLoading} pendingText="Checking status...">
                Check status
              </Button>
            </div>
          </form>
          <div className="mt-4">
            <FormStatusMessage
              status={status.type}
              message={status.message}
              icon={status.type === "error" ? CircleAlert : status.type === "success" ? CircleCheck : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {payload ? (
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Application status: {payload.status}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {payload.status === "pending" ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Clock3 className="size-4" />
                  Pending review
                </div>
                <p className="mt-2 text-muted-foreground">
                  Your application is in the admin review queue. We will contact {payload.maskedContactEmail} once a decision is made.
                </p>
              </div>
            ) : null}

            {payload.status === "approved" ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="size-4" />
                  Approved
                </div>
                <p className="mt-2 text-muted-foreground">
                  Your organizer application was approved. Use the activation or password-reset link sent to {payload.maskedContactEmail}, then sign in.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <ProgressLink href="/auth/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                    Go to login
                  </ProgressLink>
                  <ProgressLink href="/auth/forgot-password" className="font-semibold text-primary underline-offset-4 hover:underline">
                    Recover password
                  </ProgressLink>
                </div>
              </div>
            ) : null}

            {payload.status === "rejected" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <XCircle className="size-4" />
                  Not approved
                </div>
                <p className="mt-2 text-muted-foreground">
                  Your application was not approved for now. Updates are sent to {payload.maskedContactEmail}.
                </p>
                {payload.rejectionReason ? (
                  <p className="mt-2 rounded-md border border-border/60 bg-background/80 p-3 text-muted-foreground">
                    Reason: {payload.rejectionReason}
                  </p>
                ) : null}
                <div className="mt-3">
                  <ProgressLink href="/organizer/apply" className="font-semibold text-primary underline-offset-4 hover:underline">
                    Submit a new organizer application
                  </ProgressLink>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
