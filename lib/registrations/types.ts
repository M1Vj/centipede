export type RegistrationStatus = "registered" | "withdrawn" | "ineligible" | "cancelled";

export type RegistrationRow = {
  id: string;
  competition_id: string;
  profile_id: string | null;
  team_id: string | null;
  status: RegistrationStatus;
  status_reason: string | null;
  entry_snapshot_json: Record<string, unknown>;
  registered_at: string;
  updated_at: string;
};

export type RegistrationRpcResult = {
  machine_code: string;
  registration_id: string | null;
  status: RegistrationStatus | null;
  status_reason: string | null;
  entry_snapshot_json: Record<string, unknown> | null;
  replayed: boolean;
  changed: boolean;
};

export type WithdrawRegistrationResult = {
  machine_code: string;
  registration_id: string | null;
  status: RegistrationStatus | null;
  status_reason: string | null;
  replayed: boolean;
  changed: boolean;
};

export type TeamRegistrationValidationResult = {
  machine_code: string;
  team_id: string | null;
  competition_id: string | null;
  roster_count: number | null;
  required_count: number | null;
  conflict: boolean;
  eligible: boolean;
};

export type RegistrationSummary = {
  competition_id: string;
  status: RegistrationStatus | null;
  status_reason: string | null;
  id: string;
  team_id: string | null;
};

export type RegistrationCompetitionSummary = {
  id: string;
  name: string;
  type: "open" | "scheduled";
  format: "individual" | "team";
  status: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  registrationStart: string | null;
};

export type RegistrationDetail = RegistrationSummary & {
  registered_at: string | null;
  updated_at: string | null;
  competition: RegistrationCompetitionSummary | null;
};

export type OrganizerRegistrationRosterMember = {
  profileId: string | null;
  fullName: string;
  school: string | null;
  gradeLevel: string | null;
  role: string | null;
};

export type OrganizerRegistrationDetail = {
  id: string;
  competitionId: string;
  profileId: string | null;
  teamId: string | null;
  participantType: "individual" | "team";
  displayName: string;
  subtitle: string | null;
  status: RegistrationStatus;
  statusReason: string | null;
  registeredAt: string | null;
  updatedAt: string | null;
  roster: OrganizerRegistrationRosterMember[];
};
