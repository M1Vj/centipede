import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Password Reset"
      title="Recover access without leaving the arena"
      description="If a participant or coach forgets their password, this flow stays available without exposing the rest of the protected workspace."
    >
      <div className="w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}
