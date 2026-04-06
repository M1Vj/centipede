import { Library, PlusCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <section className="shell py-12 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">Problem Bank</p>
          <h1 className="text-4xl font-semibold tracking-tight">Problem banks</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage your authored problem banks and browse visible default banks curated by admins.
          </p>
        </div>

        <ProgressLink
          href="/organizer/problem-bank/create"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          <PlusCircle className="size-4" />
          Create bank
        </ProgressLink>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Unable to load problem banks.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">My banks</h2>
        {ownBanks.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-muted/20">
            <CardContent className="p-6 text-sm text-muted-foreground">
              You have not created any banks yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownBanks.map((bank) => (
              <Card key={bank.id} className="border-border/60 bg-background/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="line-clamp-1 text-xl">{bank.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10">
                    {bank.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(bank.updatedAt).toLocaleString()}
                  </p>
                  <ProgressLink
                    href={`/organizer/problem-bank/${bank.id}`}
                    className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Open bank
                  </ProgressLink>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Visible default banks</h2>
        {defaultBanks.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-muted/20">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No default banks are currently visible to organizers.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {defaultBanks.map((bank) => (
              <Card key={bank.id} className="border-border/60 bg-background/90 shadow-sm">
                <CardHeader>
                  <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    <Library className="size-3" />
                    Default bank
                  </div>
                  <CardTitle className="line-clamp-1 text-xl">{bank.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-10">
                    {bank.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Read-only access for organizers.
                  </p>
                  <ProgressLink
                    href={`/organizer/problem-bank/${bank.id}`}
                    className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Browse problems
                  </ProgressLink>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
