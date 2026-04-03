import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/sign-up-form";
import { ProgressLink } from "@/components/ui/progress-link";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Register"
      title="Create your Mathwiz Arena account"
      description="Register with Google or email, then complete your profile so the platform can route you into the right competition experience."
    >
      <div className="w-full max-w-md space-y-4">
        <SignUpForm />
        <div className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Applying as an organizer?</p>
          <p className="mt-1">
            Organizer eligibility review is handled through a separate application flow.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <ProgressLink href="/organizer/apply" className="font-semibold text-primary underline-offset-4 hover:underline">
              Open organizer application
            </ProgressLink>
            <ProgressLink href="/organizer/status" className="font-semibold text-primary underline-offset-4 hover:underline">
              Lookup application status
            </ProgressLink>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
