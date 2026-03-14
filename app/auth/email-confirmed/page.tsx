import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { EmailConfirmedContent } from "./email-confirmed-content";

function EmailConfirmedFallback() {
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
          <CardContent>
            <FormStatusMessage
              status="pending"
              message="Confirming your email and preparing your session..."
            />
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}

export default function EmailConfirmedPage() {
  return (
    <Suspense fallback={<EmailConfirmedFallback />}>
      <EmailConfirmedContent />
    </Suspense>
  );
}
