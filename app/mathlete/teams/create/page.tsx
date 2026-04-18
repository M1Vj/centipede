import { TeamForm } from "@/components/teams/team-form";
import { MathleteModalPanel } from "@/components/mathlete/modal-panel";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsCreatePage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <MathleteModalPanel
      eyebrow="Team Setup"
      title="Create New Team"
      description="Form your team of elite mathletes and climb the ranks."
    >
      <TeamForm />
    </MathleteModalPanel>
  );
}
