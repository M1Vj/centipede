import { AuthShell } from "@/components/auth-shell";
import { UpdatePasswordForm } from "@/components/update-password-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="New Password"
      title="Set a fresh password and keep moving"
      description="The reset route stays lightweight, but it now matches the same visual language as the rest of the foundation shell."
    >
      <div className="w-full max-w-md">
        <UpdatePasswordForm />
      </div>
    </AuthShell>
  );
}
