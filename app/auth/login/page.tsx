import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back to Mathwiz Arena"
      description="Pick up where you left off with Google or email login, then head straight into registrations, protected rounds, and upcoming competitions."
    >
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </AuthShell>
  );
}
