import { AuthShell } from "@/components/auth-shell";
import { ProgressLink } from "@/components/ui/progress-link";

export default function SuspendedPage() {
  return (
    <AuthShell
      eyebrow="Account Suspended"
      title="Your account is currently suspended"
      description="Please contact support if you believe this is a mistake."
    >
      <div className="w-full max-w-md space-y-4 text-sm text-muted-foreground">
        <p>
          Access to your account has been temporarily restricted by an administrator.
        </p>
        <p>
          If you need help, reach out to support with your account email and the reason you believe the suspension should be reviewed.
        </p>
        <div className="flex flex-wrap gap-4 pt-2 text-sm">
          <ProgressLink href="/" className="rounded-md bg-primary px-4 py-2 text-primary-foreground shadow hover:bg-primary/90">
            Go to landing page
          </ProgressLink>
          <ProgressLink href="/auth/login" className="text-primary underline underline-offset-4">
            Return to login
          </ProgressLink>
        </div>
      </div>
    </AuthShell>
  );
}
