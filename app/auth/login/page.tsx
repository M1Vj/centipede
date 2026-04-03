import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { ProgressLink } from "@/components/ui/progress-link";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back to Mathwiz Arena"
      description="Pick up where you left off with Google or email login, then head straight into registrations, protected rounds, and upcoming competitions."
    >
      <div className="w-full max-w-md space-y-4">
        <LoginForm />
        <div className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Need organizer access?</p>
          <p className="mt-1">
            Submit an application first, then monitor your review token status.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <ProgressLink href="/organizer/apply" className="font-semibold text-primary underline-offset-4 hover:underline">
              Apply now
            </ProgressLink>
            <ProgressLink href="/organizer/status" className="font-semibold text-primary underline-offset-4 hover:underline">
              Check status
            </ProgressLink>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
