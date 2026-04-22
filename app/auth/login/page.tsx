import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { ProgressLink } from "@/components/ui/progress-link";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome Back"
      description="Please enter your details to access your dashboard."
      mode="login"
    >
      <div className="space-y-4">
        <LoginForm />
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F49700]/10">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#F49700]">
                <path d="M8 1L10 5.5L15 6L11.5 9.5L12.5 14.5L8 12L3.5 14.5L4.5 9.5L1 6L6 5.5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#1A1E2E]">Need organizer access?</p>
              <p className="mt-1 text-slate-400">Submit your organizer application first, then monitor review status.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <ProgressLink
                  href="/organizer/apply"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F49700]/10 px-3 py-1.5 text-xs font-bold text-[#F49700] transition-colors hover:bg-[#F49700]/20"
                >
                  Apply now
                </ProgressLink>
                <ProgressLink
                  href="/organizer/status"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Check status
                </ProgressLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
