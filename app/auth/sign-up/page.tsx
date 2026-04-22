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
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F49700]/10">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#F49700]">
                <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#1A1E2E]">Applying as an organizer?</p>
              <p className="mt-1 text-slate-400">
                Organizer eligibility review is handled through a separate application flow.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <ProgressLink
                  href="/organizer/apply"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F49700]/10 px-3 py-1.5 text-xs font-bold text-[#F49700] transition-colors hover:bg-[#F49700]/20"
                >
                  Open organizer application
                </ProgressLink>
                <ProgressLink
                  href="/organizer/status"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Lookup application status
                </ProgressLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
