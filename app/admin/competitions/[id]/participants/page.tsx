import { notFound } from "next/navigation";
import { CompetitionParticipantsPanel } from "@/components/organizer/competition-participants-panel";
import {
  listCompetitionScopedRegistrations,
  loadMonitoringCompetition,
  loadMonitoringData,
} from "@/components/monitoring/server-data";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function AdminCompetitionParticipantsPage({ params, searchParams }: PageProps) {
  const { id: competitionId } = await params;
  const query = await searchParams;
  const competition = await loadMonitoringCompetition(competitionId);

  if (!competition) {
    notFound();
  }

  const registrations = await listCompetitionScopedRegistrations(competitionId);
  const monitoring = await loadMonitoringData(competitionId, registrations);

  return (
    <div className="shell py-8">
      <CompetitionParticipantsPanel
        competition={competition}
        registrations={registrations}
        activeAttempts={monitoring.activeAttempts}
        finishedAttempts={monitoring.finishedAttempts}
        events={monitoring.events}
        initialTab={query?.tab}
        routePath={`/admin/competitions/${competitionId}/participants`}
        mode="admin"
      />
    </div>
  );
}
