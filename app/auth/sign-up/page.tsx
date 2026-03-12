import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Register"
      title="Create your Mathwiz Arena account"
      description="Register with Google or email, then complete your profile so the platform can route you into the right competition experience."
    >
      <div className="w-full max-w-md">
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
