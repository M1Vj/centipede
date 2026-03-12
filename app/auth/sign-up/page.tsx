import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Register"
      title="Create your Mathwiz Arena account"
      description="The foundation branch keeps registration simple while the next authentication branch adds profile completion, Google OAuth, and role-aware routing."
    >
      <div className="w-full max-w-md">
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
