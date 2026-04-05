export type OrganizerProvisioningStatus = "pending" | "approved" | "rejected";

export type OrganizerProvisioningSnapshot = {
  status: OrganizerProvisioningStatus;
  profileId: string | null;
  hasLinkedProfile: boolean;
  profileRole: string | null;
  profileApprovedAt: string | null;
};

export type OrganizerProvisioningCheck =
  | {
      ok: true;
    }
  | {
      ok: false;
      code:
        | "not_approved"
        | "missing_profile_link"
        | "missing_profile_record"
        | "role_mismatch"
        | "missing_approved_at";
      message: string;
    };

export function checkOrganizerProvisioning(
  snapshot: OrganizerProvisioningSnapshot,
): OrganizerProvisioningCheck {
  if (snapshot.status !== "approved") {
    return {
      ok: false,
      code: "not_approved",
      message: "Application is not in approved state yet.",
    };
  }

  if (!snapshot.profileId) {
    return {
      ok: false,
      code: "missing_profile_link",
      message:
        "Provisioning incomplete: approved application is not linked to a profile yet. Retry provisioning.",
    };
  }

  if (!snapshot.hasLinkedProfile) {
    return {
      ok: false,
      code: "missing_profile_record",
      message:
        "Provisioning incomplete: linked profile record is unavailable. Retry provisioning.",
    };
  }

  if (snapshot.profileRole !== "organizer") {
    return {
      ok: false,
      code: "role_mismatch",
      message:
        "Provisioning incomplete: linked profile role is not organizer. Retry provisioning.",
    };
  }

  if (!snapshot.profileApprovedAt) {
    return {
      ok: false,
      code: "missing_approved_at",
      message:
        "Provisioning incomplete: organizer approval timestamp is missing. Retry provisioning.",
    };
  }

  return { ok: true };
}

export function needsProvisioningRetry(snapshot: OrganizerProvisioningSnapshot) {
  if (snapshot.status !== "approved") {
    return false;
  }

  return !checkOrganizerProvisioning(snapshot).ok;
}
