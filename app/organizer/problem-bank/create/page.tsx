import { BankForm } from "@/components/problem-bank/bank-form";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function OrganizerProblemBankCreatePage() {
  await getWorkspaceContext({ requireRole: "organizer" });

  return (
    <section className="shell py-12 space-y-6">
      <div className="space-y-2">
        <ProgressLink
          href="/organizer/problem-bank"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Back to problem banks
        </ProgressLink>
        <h1 className="text-3xl font-semibold tracking-tight">Create a problem bank</h1>
        <p className="text-sm text-muted-foreground">
          Start a new authored bank for competition-ready reusable problems.
        </p>
      </div>

      <div className="max-w-3xl">
        <BankForm mode="create" successRedirectHref="/organizer/problem-bank" />
      </div>
    </section>
  );
}
