import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/sign-up-form";
import { ProgressLink } from "@/components/ui/progress-link";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Register"
      title="Create your account"
      description="Start your MathWiz workspace and finish profile setup in a few quick steps."
      mode="sign-up"
    >
      <div className="space-y-4">
        <SignUpForm />
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-500">
          <p className="font-semibold text-[#0f172a]">Applying as an organizer?</p>
          <p className="mt-1">
            Organizer eligibility review is handled through a separate application flow.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <ProgressLink
              href="/organizer/apply"
              className="font-semibold text-[#0f172a] underline-offset-4 hover:text-[#f49700] hover:underline"
            >
              Open organizer application
            </ProgressLink>
            <ProgressLink
              href="/organizer/status"
              className="font-semibold text-[#0f172a] underline-offset-4 hover:text-[#f49700] hover:underline"
            >
              Lookup application status
            </ProgressLink>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
