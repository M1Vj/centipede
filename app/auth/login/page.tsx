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
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-500">
          <p className="font-semibold text-[#0f172a]">Need organizer access?</p>
          <p className="mt-1">Submit your organizer application first, then monitor review status.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <ProgressLink
              href="/organizer/apply"
              className="font-semibold text-[#0f172a] underline-offset-4 hover:text-[#f49700] hover:underline"
            >
              Apply now
            </ProgressLink>
            <ProgressLink
              href="/organizer/status"
              className="font-semibold text-[#0f172a] underline-offset-4 hover:text-[#f49700] hover:underline"
            >
              Check status
            </ProgressLink>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
