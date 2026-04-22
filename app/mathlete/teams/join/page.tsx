import { TeamJoinForm } from "@/components/teams/team-join-form";
import { MathleteModalPanel } from "@/components/mathlete/modal-panel";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsJoinPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <MathleteModalPanel
      title="Join via Team Code"
      description="Enter the code provided by your team leader to join their squad."
      className="max-w-[560px]"
    >
      <TeamJoinForm />
    </MathleteModalPanel>
  );
}
