import { getWorkspaceContext as getProtectedWorkspaceContext } from "@/lib/auth/workspace";
import { MathleteDashboardOverview } from "@/components/mathlete/dashboard-overview";

async function getWorkspaceContext() {
  return getProtectedWorkspaceContext({ requireRole: "mathlete" });
}

export default async function MathletePage() {
  const { userEmail, profile } = await getWorkspaceContext();
  const fallbackName = userEmail?.split("@")[0] ?? "Mathlete";
  const displayName =
    profile?.full_name?.trim()?.split(/\s+/)[0] ||
    fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);

  return (
    <MathleteDashboardOverview
      displayName={displayName}
      profileComplete={Boolean(profile?.school && profile?.grade_level)}
      liveCards={[]}
      upcomingCards={[]}
      activityItems={[]}
    />
  );
}
