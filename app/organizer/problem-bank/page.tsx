import { ArrowRight, Calendar, Edit3, FileText, Library, PlusCircle } from "lucide-react";
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
  const problemCounts = new Map<string, number>();

  if (!error && banks.length > 0) {
    const { data: problemRows, error: problemCountsError } = await supabase
      .from("problems")
      .select("bank_id")
      .in(
        "bank_id",
        banks.map((bank) => bank.id),
      )
      .eq("is_deleted", false);

    if (!problemCountsError) {
      (problemRows ?? []).forEach((row) => {
        if (typeof row.bank_id !== "string") {
          return;
        }

        problemCounts.set(row.bank_id, (problemCounts.get(row.bank_id) ?? 0) + 1);
      });
    }
  }

  const ownBanks = banks.filter(
    (bank) => bank.organizerId === profile?.id && !bank.isDefaultBank,
  );
  const defaultBanks = banks.filter((bank) => bank.isDefaultBank && bank.isVisibleToOrganizers);

  return (
    <section className="organizer-shell flex w-full justify-center px-4">
      <div className="shell flex w-full max-w-[1024px] flex-col pb-12 pt-8 md:pt-10 font-['Poppins'] space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="organizer-kicker mb-3">Organizer / problem banks</span>
            <h1 className="mb-2 text-3xl font-black leading-tight tracking-tight text-foreground md:text-[34px]">
              Problem banks
            </h1>
            <p className="max-w-2xl text-[15px] font-medium text-foreground/60">
              Manage authored banks and browse visible default banks curated by admins.
            </p>
          </div>

          <ProgressLink href="/organizer/problem-bank/create" className="organizer-action self-start no-underline md:self-auto">
            <PlusCircle className="size-5" />
            Create bank
          </ProgressLink>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            Unable to load problem banks.
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="organizer-panel flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">My banks</p>
              <p className="mt-1 text-sm text-foreground/60">Your authored bank library and editable workspaces.</p>
            </div>
            <span className="organizer-muted-kicker">{ownBanks.length} banks</span>
          </div>
          {ownBanks.length === 0 ? (
            <div className="organizer-panel organizer-panel-soft p-8 text-center text-sm text-foreground/50">
              You have not created any banks yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ownBanks.map((bank) => (
                <div key={bank.id} className="organizer-panel organizer-panel-hover flex h-full flex-col p-6">
                  <div className="mb-4">
                    <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black tracking-widest text-primary">
                      AUTHORED
                    </span>
                    <h3 className="mb-3 line-clamp-2 text-[20px] font-bold leading-snug text-foreground">{bank.name}</h3>
                    <p className="line-clamp-3 text-[14px] leading-relaxed text-foreground/55">
                      {bank.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-5 flex flex-wrap items-center gap-4 text-[12px] font-semibold text-foreground/45">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" /> {problemCounts.get(bank.id) ?? 0} Problems
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Updated {new Date(bank.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ProgressLink
                      href={`/organizer/problem-bank/${bank.id}`}
                      className="organizer-action w-full justify-center no-underline"
                    >
                      Manage Bank <Edit3 className="w-4 h-4" />
                    </ProgressLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="organizer-panel flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/45">Visible default banks</p>
              <p className="mt-1 text-sm text-foreground/60">Read-only defaults available to organizers.</p>
            </div>
            <span className="organizer-muted-kicker">{defaultBanks.length} shared</span>
          </div>
          {defaultBanks.length === 0 ? (
            <div className="organizer-panel organizer-panel-soft p-8 text-center text-sm text-foreground/50">
              No default banks are currently visible to organizers.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {defaultBanks.map((bank) => (
                <div key={bank.id} className="organizer-panel organizer-panel-soft flex h-full flex-col p-6 opacity-95 transition-all hover:-translate-y-0.5 hover:opacity-100">
                  <div className="mb-4">
                    <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#111827]/10 px-2.5 py-1 text-[10px] font-black tracking-widest text-[#111827]">
                      <Library className="w-3 h-3" /> DEFAULT
                    </span>
                    <h3 className="mb-3 line-clamp-2 text-[20px] font-bold leading-snug text-foreground">{bank.name}</h3>
                    <p className="line-clamp-3 text-[14px] leading-relaxed text-foreground/55">
                      {bank.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-5 flex flex-wrap items-center gap-4 text-[12px] font-semibold text-foreground/45">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" /> {problemCounts.get(bank.id) ?? 0} Problems
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Updated {new Date(bank.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ProgressLink
                      href={`/organizer/problem-bank/${bank.id}`}
                      className="organizer-action-secondary w-full justify-center no-underline"
                    >
                      Browse <ArrowRight className="w-4 h-4" />
                    </ProgressLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
