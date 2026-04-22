export type RegistrationMessageTone = "success" | "warning" | "error";

export function registrationMachineCodeMessage(machineCode: string): {
  tone: RegistrationMessageTone;
  message: string;
} {
  switch (machineCode) {
    case "ok":
      return { tone: "success", message: "Registration confirmed." };
    case "already_registered":
      return { tone: "warning", message: "You are already registered." };
    case "registration_not_started":
      return { tone: "warning", message: "Registration has not opened yet." };
    case "registration_closed":
    case "registration_window_missing":
      return { tone: "warning", message: "Registration is closed." };
    case "competition_started":
      return { tone: "warning", message: "Registration closed because the competition has started." };
    case "capacity_full":
      return { tone: "warning", message: "This competition is full." };
    case "profile_incomplete":
      return { tone: "warning", message: "Complete your profile before registering." };
    case "team_required":
    case "team_registration_not_allowed":
      return { tone: "warning", message: "This competition requires a team registration." };
    case "not_team_leader":
      return { tone: "warning", message: "Only a team leader can register this team." };
    case "team_size_invalid":
      return { tone: "warning", message: "Team size does not meet the competition requirement." };
    case "team_member_conflict":
      return { tone: "warning", message: "One or more team members are already registered with another team." };
    case "team_member_profile_incomplete":
      return { tone: "warning", message: "A team member must complete their profile before registering." };
    case "team_archived":
      return { tone: "warning", message: "This team is archived and cannot register." };
    case "ineligible":
      return { tone: "warning", message: "This team is currently ineligible. Fix the roster and try again." };
    case "competition_deleted":
    case "competition_unavailable":
    case "competition_not_found":
      return { tone: "error", message: "This competition is unavailable." };
    case "request_idempotency_token_required":
    case "competition_id_required":
      return { tone: "error", message: "Registration request was invalid." };
    case "deferred_owner_schema":
      return { tone: "error", message: "Registration is not available yet." };
    default:
      return { tone: "error", message: "Registration could not be completed." };
  }
}

export function withdrawalMachineCodeMessage(machineCode: string): {
  tone: RegistrationMessageTone;
  message: string;
} {
  switch (machineCode) {
    case "ok":
      return { tone: "success", message: "Registration withdrawn." };
    case "attempts_exist":
      return { tone: "warning", message: "You cannot withdraw after starting an attempt." };
    case "withdrawal_after_start":
      return { tone: "warning", message: "Withdrawal is closed because the competition has started." };
    case "already_withdrawn":
      return { tone: "warning", message: "Registration is already withdrawn." };
    case "invalid_status":
      return { tone: "warning", message: "This registration cannot be withdrawn." };
    case "forbidden":
      return { tone: "error", message: "You are not allowed to withdraw this registration." };
    case "request_idempotency_token_required":
    case "status_reason_required":
    case "registration_id_required":
      return { tone: "error", message: "Withdrawal request was invalid." };
    case "competition_not_found":
    case "not_found":
      return { tone: "error", message: "Registration not found." };
    case "deferred_owner_schema":
      return { tone: "error", message: "Withdrawal is not available yet." };
    default:
      return { tone: "error", message: "Unable to withdraw registration." };
  }
}
