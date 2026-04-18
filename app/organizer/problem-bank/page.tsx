import { ArrowRight, Library, PlusCircle } from "lucide-react";
import {
  OrganizerMetricTile,
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerPrimaryActionClass,
} from "@/components/organizer/workspace-patterns";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { normalizeProblemBankRow } from "@/lib/problem-bank/api-helpers";
import { createClient } from "@/lib/supabase/server";

export default async function OrganizerProblemBankPage() {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("problem_banks")
    .select(
      "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at",
    )
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const banks = !error
    ? (data ?? [])
        .map((row) => normalizeProblemBankRow(row))
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];

  const ownBanks = banks.filter(
    (bank) => bank.organizerId === profile?.id && !bank.isDefaultBank,
  );
  const defaultBanks = banks.filter((bank) => bank.isDefaultBank && bank.isVisibleToOrganizers);

  return (
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        eyebrow="Problem Bank"
        title="Problem Banks"
        description="Manage authored banks and browse default shared banks curated by admins for organizer reuse."
        actions={
          <ProgressLink href="/organizer/problem-bank/create" className={organizerPrimaryActionClass}>
            <PlusCircle className="size-4" />
            Add Problem Bank
          </ProgressLink>
        }
      />

      <OrganizerWorkspacePanel className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
            All Banks
          </span>
          <span className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            My Banks
          </span>
          <span className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            Shared with me
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <OrganizerMetricTile label="Total banks" value={banks.length} />
          <OrganizerMetricTile label="My authored" value={ownBanks.length} />
          <OrganizerMetricTile label="Default shared" value={defaultBanks.length} />
        </div>
      </OrganizerWorkspacePanel>

      {error ? (
        <OrganizerWorkspacePanel className="border-destructive/30 bg-destructive/10 text-sm text-destructive">
          Unable to load problem banks.
        </OrganizerWorkspacePanel>
      ) : null}

      <OrganizerWorkspacePanel className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">My banks</h2>
          <span className="text-xs text-muted-foreground">{ownBanks.length} banks</span>
        </div>
        {ownBanks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            You have not created any banks yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownBanks.map((bank) => (
              <div
                key={bank.id}
                className="surface-card rounded-xl border border-border/60 bg-background/80 p-5 shadow-sm"
              >
                <div className="space-y-2">
                  <h3 className="line-clamp-1 text-xl font-semibold text-foreground">{bank.name}</h3>
                  <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
                    {bank.description || "No description provided."}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(bank.updatedAt).toLocaleDateString()}
                  </p>
                  <ProgressLink
                    href={`/organizer/problem-bank/${bank.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    View
                    <ArrowRight className="size-4" />
                  </ProgressLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </OrganizerWorkspacePanel>

      <OrganizerWorkspacePanel className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Visible default banks</h2>
          <span className="text-xs text-muted-foreground">{defaultBanks.length} shared</span>
        </div>
        {defaultBanks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            No default banks are currently visible to organizers.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {defaultBanks.map((bank) => (
              <div
                key={bank.id}
                className="surface-card rounded-xl border border-border/60 bg-background/80 p-5 shadow-sm"
              >
                <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  <Library className="size-3" />
                  Default bank
                </div>
                <div className="space-y-2">
                  <h3 className="line-clamp-1 text-xl font-semibold text-foreground">{bank.name}</h3>
                  <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
                    {bank.description || "No description provided."}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Read-only access</p>
                  <ProgressLink
                    href={`/organizer/problem-bank/${bank.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Browse
                    <ArrowRight className="size-4" />
                  </ProgressLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </OrganizerWorkspacePanel>
    </OrganizerWorkspaceShell>
  );
}
