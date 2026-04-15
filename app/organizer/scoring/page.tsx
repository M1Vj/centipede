import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function OrganizerScoringPage() {
  await getWorkspaceContext({ requireRole: "organizer" });
  redirect("/organizer/competition/create");
}
