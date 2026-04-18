import { ArrowLeft } from "lucide-react";
import { BankForm } from "@/components/problem-bank/bank-form";
import {
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerSecondaryActionClass,
} from "@/components/organizer/workspace-patterns";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function OrganizerProblemBankCreatePage() {
  await getWorkspaceContext({ requireRole: "organizer" });

  return (
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        breadcrumbs={[
          { label: "Problem Banks", href: "/organizer/problem-bank" },
          { label: "Create" },
        ]}
        eyebrow="Problem Bank"
        title="Create a problem bank"
        description="Start a new authored bank for reusable, competition-ready problems."
        actions={
          <ProgressLink href="/organizer/problem-bank" className={organizerSecondaryActionClass}>
            <ArrowLeft className="size-4" />
            Back to problem banks
          </ProgressLink>
        }
      />

      <OrganizerWorkspacePanel className="mx-auto w-full max-w-4xl border-amber-200/60 dark:border-amber-700/50">
        <BankForm mode="create" successRedirectHref="/organizer/problem-bank" />
      </OrganizerWorkspacePanel>
    </OrganizerWorkspaceShell>
  );
}
