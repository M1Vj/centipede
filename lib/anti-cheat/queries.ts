import { createClient } from '@/lib/supabase/server';

export interface OffenseLog {
  id: string;
  offense_number: number;
  penalty_applied: string;
  logged_at: string;
  client_timestamp: string | null;
  metadata_json: Record<string, unknown>;
  competition_attempts: {
    competition_registrations: {
      profile_id: string | null;
      team_id: string | null;
      profiles: { full_name: string } | null;
      teams: { name: string } | null;
    } | null;
  } | null;
}

export async function getCompetitionOffenses(competitionId: string): Promise<OffenseLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tab_switch_logs')
    .select(`
      id,
      offense_number,
      penalty_applied,
      logged_at,
      client_timestamp,
      metadata_json,
      competition_attempts!inner(
        competition_id,
        competition_registrations(
          profile_id,
          team_id,
          profiles(full_name),
          teams(name)
        )
      )
    `)
    .eq('competition_attempts.competition_id', competitionId)
    .order('logged_at', { ascending: false });

  if (error) {
    console.error('Error fetching offense logs:', error);
    return [];
  }

  return (data as unknown) as OffenseLog[];
}
