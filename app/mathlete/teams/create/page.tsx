import { TeamForm } from "@/components/teams/team-form";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsCreatePage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell pb-16 pt-8 md:pt-10">
      <div className="mx-auto max-w-2xl">
        <TeamForm />
      </div>
    </section>
  );
}
