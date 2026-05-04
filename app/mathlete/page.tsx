import { getWorkspaceContext as getProtectedWorkspaceContext } from "@/lib/auth/workspace";
import { MathleteDashboardOverview } from "@/components/mathlete/dashboard-overview";
import { UpcomingCompetitionRefresh } from "@/components/mathlete/upcoming-competition-refresh";
import { listMyRegistrationDetails } from "@/lib/registrations/api";
import { runDueScheduledCompetitionLifecycleSafely } from "@/lib/competition/scheduled-start";
import { buildMathleteDashboardCards } from "@/lib/mathlete/dashboard-cards";

async function getWorkspaceContext() {
  return getProtectedWorkspaceContext({ requireRole: "mathlete" });
}

export default async function MathletePage() {
  const { userEmail, profile } = await getWorkspaceContext();
  const fallbackName = userEmail?.split("@")[0] ?? "Mathlete";
  const displayName =
    profile?.full_name?.trim()?.split(/\s+/)[0] ||
    fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);

  await runDueScheduledCompetitionLifecycleSafely();

  const registrationCards = buildMathleteDashboardCards(
    await listMyRegistrationDetails({ statuses: ["registered"], limit: 25 }),
  );

  return (
    <>
      <UpcomingCompetitionRefresh upcomingCards={registrationCards.upcomingCards} />
      <MathleteDashboardOverview
        displayName={displayName}
        profileComplete={Boolean(profile?.school && profile?.grade_level)}
        liveCards={registrationCards.liveCards}
        upcomingCards={registrationCards.upcomingCards}
        registrationCards={registrationCards.registrationCards}
        activityItems={registrationCards.activityItems}
      />
    </>
  );
}
