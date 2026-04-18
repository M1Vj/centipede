import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Password Reset"
      title="Reset your password"
      description="Enter your account email and we will send a secure reset link."
      mode="forgot-password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
