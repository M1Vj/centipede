import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back to Mathwiz Arena"
      description="Sign in to access registrations, upcoming competitions, and the protected dashboards that land in the next branches."
    >
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </AuthShell>
  );
}
