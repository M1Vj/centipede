import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/errors";
import {
  ORGANIZER_LOGO_BUCKET,
  ORGANIZER_RESET_REDIRECT_PATH,
} from "@/lib/organizer/constants";
import {
  sendOrganizerLifecycleEmail,
  type OrganizerEmailMessageType,
} from "@/lib/organizer/email";
import {
  createStatusLookupToken,
  getStatusLookupTokenExpiryDate,
  hashStatusLookupToken,
} from "@/lib/organizer/tokens";
import {
  type OrganizerApplicationInput,
  validateLogoUpload,
  validateOrganizerApplicationInput,
} from "@/lib/organizer/validation";
import { getSupabaseEnv } from "@/lib/supabase/env";

type OrganizerApplicationRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  profile_id: string | null;
  applicant_full_name: string | null;
  organization_name: string | null;
  contact_email: string | null;
  rejection_reason: string | null;
};

type StatusLookupResult =
  | {
      machineCode: "ok";
      status: "pending" | "approved" | "rejected";
      rejectionReason: string | null;
      maskedContactEmail: string;
    }
  | {
      machineCode: "not_found" | "throttled";
    };

type SubmitOrganizerApplicationInput = OrganizerApplicationInput & {
  logoFile: File | null;
  profileId: string | null;
};

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

function isMissingOrganizerLifecycleRpc(
  error: SupabaseError | null | undefined,
  rpcName: string,
) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  if (error.code === "42883") {
    return true;
  }

  return (
    message.includes(`could not find the function public.${rpcName}`) ||
    message.includes(`function public.${rpcName}`) ||
    message.includes(`function ${rpcName}`)
  );
}

function isMissingOrganizerLifecycleColumn(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42703" ||
    message.includes("contact_email") ||
    message.includes("contact_phone") ||
    message.includes("organization_type") ||
    message.includes("legal_consent_at") ||
    message.includes("status_lookup_token_hash") ||
    message.includes("status_lookup_token_expires_at")
  );
}

function sanitizeSafePublicRejectionReason(reason: string | null) {
  let sanitized = reason ?? "";

  sanitized = sanitized.replace(/<[^>]+>/gi, " ");
  sanitized = sanitized.replace(/(https?:\/\/|www\.)\S+/gi, "[redacted-link]");
  sanitized = sanitized.replace(
    /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi,
    "[redacted-email]",
  );
  sanitized = sanitized.replace(/(\+?\d[\d\s().-]{6,}\d)/g, "[redacted-phone]");
  sanitized = sanitized.trim();

  if (!sanitized) {
    return null;
  }

  return sanitized.slice(0, 500);
}

function maskContactEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");

  if (atIndex <= 0) {
    return "***";
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

function createOrganizerAdminClient() {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseEnv();

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for organizer workflows.");
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function getAbsolutePath(path: string) {
  return `${getBaseUrl()}${path}`;
}

async function claimCommunication(
  applicationId: string,
  messageType: OrganizerEmailMessageType,
  recipientEmail: string,
  payload: Record<string, unknown>,
) {
  const admin = createOrganizerAdminClient();
  const { data, error } = await admin.rpc("claim_organizer_application_communication", {
    p_application_id: applicationId,
    p_message_type: messageType,
    p_recipient_email: recipientEmail,
    p_payload_json: payload,
  });

  if (error) {
    throw error;
  }

  return (data as string | null) ?? null;
}

async function markCommunicationSent(
  communicationId: string,
  providerMessageId?: string | null,
) {
  const admin = createOrganizerAdminClient();
  const { error } = await admin.rpc("mark_organizer_application_communication_sent", {
    p_communication_id: communicationId,
    p_provider_message_id: providerMessageId || null,
  });

  if (error) {
    throw error;
  }
}

async function markCommunicationFailed(communicationId: string, errorMessage: string) {
  const admin = createOrganizerAdminClient();
  const { error } = await admin.rpc("mark_organizer_application_communication_failed", {
    p_communication_id: communicationId,
    p_error: errorMessage,
  });

  if (error) {
    throw error;
  }
}

async function dispatchLifecycleEmail(
  communicationId: string,
  payload: {
    messageType: OrganizerEmailMessageType;
    recipientEmail: string;
    applicantName: string;
    organizationName: string;
    statusLink?: string;
    activationLink?: string;
    rejectionReason?: string | null;
  },
) {
  try {
    const { providerMessageId } = await sendOrganizerLifecycleEmail(payload);
    await markCommunicationSent(communicationId, providerMessageId);
    return true;
  } catch (error) {
    await markCommunicationFailed(
      communicationId,
      getErrorMessage(error, "Organizer lifecycle email dispatch failed."),
    );
    return false;
  }
}

async function loadApplicationById(applicationId: string) {
  const admin = createOrganizerAdminClient();
  const { data, error } = await admin
    .from("organizer_applications")
    .select(
      "id,status,profile_id,applicant_full_name,organization_name,contact_email,rejection_reason",
    )
    .eq("id", applicationId)
    .maybeSingle<OrganizerApplicationRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function insertOrganizerApplicationIntakeFallback(
  admin: ReturnType<typeof createOrganizerAdminClient>,
  input: {
    applicantFullName: string;
    organizationName: string;
    contactEmail: string;
    contactPhone: string;
    organizationType: string;
    statement: string;
    legalConsentAt: string;
    statusLookupTokenHash: string;
    statusLookupTokenExpiresAt: string;
    profileId: string | null;
  },
) {
  try {
    const { data: existingPending, error: existingPendingError } = await admin
      .from("organizer_applications")
      .select("id, profile_id")
      .ilike("contact_email", input.contactEmail)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; profile_id: string | null }>();

    if (existingPendingError) {
      throw existingPendingError;
    }

    if (existingPending?.id) {
      const { error: updateError } = await admin
        .from("organizer_applications")
        .update({
          profile_id: existingPending.profile_id ?? input.profileId,
          applicant_full_name: input.applicantFullName,
          organization_name: input.organizationName,
          contact_email: input.contactEmail,
          contact_phone: input.contactPhone,
          organization_type: input.organizationType,
          statement: input.statement,
          legal_consent_at: input.legalConsentAt,
          status_lookup_token_hash: input.statusLookupTokenHash,
          status_lookup_token_expires_at: input.statusLookupTokenExpiresAt,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", existingPending.id);

      if (updateError) {
        throw updateError;
      }

      return {
        applicationId: existingPending.id,
        createdNew: false,
      };
    }

    const { data: insertedRow, error: insertError } = await admin
      .from("organizer_applications")
      .insert({
        profile_id: input.profileId,
        applicant_full_name: input.applicantFullName,
        organization_name: input.organizationName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        organization_type: input.organizationType,
        statement: input.statement,
        legal_consent_at: input.legalConsentAt,
        status_lookup_token_hash: input.statusLookupTokenHash,
        status_lookup_token_expires_at: input.statusLookupTokenExpiresAt,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const applicationId = (insertedRow as { id?: string } | null)?.id;

    if (!applicationId) {
      throw new Error("Unable to persist organizer application.");
    }

    return {
      applicationId,
      createdNew: true,
    };
  } catch (error) {
    if (isMissingOrganizerLifecycleColumn(error as SupabaseError)) {
      throw new Error("Organizer applications are temporarily unavailable. Please try again later.");
    }

    throw error;
  }
}

async function lookupOrganizerApplicationStatusFallback(
  admin: ReturnType<typeof createOrganizerAdminClient>,
  statusLookupToken: string,
): Promise<StatusLookupResult> {
  const statusLookupTokenHash = hashStatusLookupToken(statusLookupToken);

  if (!statusLookupTokenHash) {
    return { machineCode: "not_found" };
  }

  const { data, error } = await admin
    .from("organizer_applications")
    .select("status,rejection_reason,contact_email")
    .eq("status_lookup_token_hash", statusLookupTokenHash)
    .gt("status_lookup_token_expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle<{
      status: "pending" | "approved" | "rejected" | null;
      rejection_reason: string | null;
      contact_email: string | null;
    }>();

  if (error) {
    if (isMissingOrganizerLifecycleColumn(error as SupabaseError)) {
      return { machineCode: "not_found" };
    }

    throw error;
  }

  if (!data?.status || !data.contact_email) {
    return { machineCode: "not_found" };
  }

  return {
    machineCode: "ok",
    status: data.status,
    rejectionReason:
      data.status === "rejected"
        ? sanitizeSafePublicRejectionReason(data.rejection_reason)
        : null,
    maskedContactEmail: maskContactEmail(data.contact_email),
  };
}

async function resolveProfileForApprovedApplication(application: OrganizerApplicationRow) {
  const admin = createOrganizerAdminClient();

  if (application.profile_id) {
    return {
      profileId: application.profile_id,
      invitedIdentity: false,
    };
  }

  const contactEmail = application.contact_email?.toLowerCase();
  if (!contactEmail) {
    return {
      profileId: null,
      invitedIdentity: false,
    };
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", contactEmail)
    .maybeSingle<{ id: string }>();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    return {
      profileId: existingProfile.id,
      invitedIdentity: false,
    };
  }

  const inviteResult = await admin.auth.admin.inviteUserByEmail(contactEmail, {
    data: {
      full_name: application.applicant_full_name || "",
    },
    redirectTo: getAbsolutePath(ORGANIZER_RESET_REDIRECT_PATH),
  });

  let invitedIdentity = false;
  let invitedUserId: string | null = null;

  if (inviteResult.error) {
    const inviteMessage = inviteResult.error.message.toLowerCase();

    if (!inviteMessage.includes("already")) {
      throw inviteResult.error;
    }
  } else {
    invitedIdentity = true;
    invitedUserId = inviteResult.data.user?.id || null;
  }

  if (invitedUserId) {
    const { error: upsertProfileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          email: contactEmail,
          full_name: application.applicant_full_name || "",
          organization: application.organization_name,
        },
        { onConflict: "id" },
      );

    if (upsertProfileError) {
      throw upsertProfileError;
    }

    return {
      profileId: invitedUserId,
      invitedIdentity,
    };
  }

  const { data: profileAfterInvite, error: profileAfterInviteError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", contactEmail)
    .maybeSingle<{ id: string }>();

  if (profileAfterInviteError) {
    throw profileAfterInviteError;
  }

  return {
    profileId: profileAfterInvite?.id ?? null,
    invitedIdentity,
  };
}

async function sendApprovedActivation(
  application: OrganizerApplicationRow,
  communicationId: string,
  invitedIdentity: boolean,
) {
  const admin = createOrganizerAdminClient();
  const contactEmail = application.contact_email?.toLowerCase();

  if (!contactEmail) {
    await markCommunicationFailed(communicationId, "Approved application is missing contact email.");
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const { data: recoveryLinkData, error: recoveryLinkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: contactEmail,
      options: {
        redirectTo: getAbsolutePath(ORGANIZER_RESET_REDIRECT_PATH),
      },
    });

    if (recoveryLinkError) {
      await markCommunicationFailed(communicationId, recoveryLinkError.message);
      return;
    }

    const actionLink = recoveryLinkData.properties?.action_link;

    await dispatchLifecycleEmail(communicationId, {
      messageType: "approved",
      recipientEmail: contactEmail,
      applicantName: application.applicant_full_name || "Organizer Applicant",
      organizationName: application.organization_name || "your organization",
      activationLink: actionLink || undefined,
      statusLink: `${getBaseUrl()}/organizer/status`,
    });

    return;
  }

  if (invitedIdentity) {
    await markCommunicationSent(communicationId, "supabase-auth:invite");
    return;
  }

  const { error: resetError } = await admin.auth.resetPasswordForEmail(contactEmail, {
    redirectTo: getAbsolutePath(ORGANIZER_RESET_REDIRECT_PATH),
  });

  if (resetError) {
    await markCommunicationFailed(communicationId, resetError.message);
    return;
  }

  await markCommunicationSent(communicationId, "supabase-auth:recovery");
}

export async function submitOrganizerApplication(
  input: SubmitOrganizerApplicationInput,
) {
  const validatedInput = validateOrganizerApplicationInput(input);
  const logoMeta = validateLogoUpload(input.logoFile);

  const statusLookupToken = createStatusLookupToken();
  const statusLookupTokenHash = hashStatusLookupToken(statusLookupToken);
  if (!statusLookupTokenHash) {
    throw new Error("Failed to create a valid status lookup token.");
  }

  const statusLookupTokenExpiresAt = getStatusLookupTokenExpiryDate();
  const legalConsentAt = new Date().toISOString();

  const admin = createOrganizerAdminClient();

  const { data, error } = await admin.rpc("insert_organizer_application_intake", {
    p_applicant_full_name: validatedInput.applicantFullName,
    p_organization_name: validatedInput.organizationName,
    p_contact_email: validatedInput.contactEmail,
    p_contact_phone: validatedInput.contactPhone,
    p_organization_type: validatedInput.organizationType,
    p_statement: validatedInput.statement,
    p_legal_consent_at: legalConsentAt,
    p_status_lookup_token_hash: statusLookupTokenHash,
    p_status_lookup_token_expires_at: statusLookupTokenExpiresAt.toISOString(),
    p_profile_id: input.profileId,
  });

  let inserted = (data as Array<{ application_id: string; created_new: boolean }> | null)?.[0] ?? null;

  if (error) {
    if (!isMissingOrganizerLifecycleRpc(error as SupabaseError, "insert_organizer_application_intake")) {
      throw error;
    }

    const fallbackInserted = await insertOrganizerApplicationIntakeFallback(admin, {
      applicantFullName: validatedInput.applicantFullName,
      organizationName: validatedInput.organizationName,
      contactEmail: validatedInput.contactEmail,
      contactPhone: validatedInput.contactPhone,
      organizationType: validatedInput.organizationType,
      statement: validatedInput.statement,
      legalConsentAt,
      statusLookupTokenHash,
      statusLookupTokenExpiresAt: statusLookupTokenExpiresAt.toISOString(),
      profileId: input.profileId,
    });

    inserted = {
      application_id: fallbackInserted.applicationId,
      created_new: fallbackInserted.createdNew,
    };
  }

  if (!inserted?.application_id) {
    throw new Error("Unable to persist organizer application.");
  }

  const applicationId = inserted.application_id;

  if (logoMeta && input.logoFile) {
    const logoPath = `organizer-applications/${applicationId}/logo.${logoMeta.extension}`;
    const logoBuffer = await input.logoFile.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from(ORGANIZER_LOGO_BUCKET)
      .upload(logoPath, logoBuffer, {
        contentType: logoMeta.contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { error: updateError } = await admin
      .from("organizer_applications")
      .update({ logo_path: logoPath })
      .eq("id", applicationId);

    if (updateError) {
      throw updateError;
    }
  }

  const statusLookupUrl = `${getBaseUrl()}/organizer/status?token=${statusLookupToken}`;

  try {
    const communicationId = await claimCommunication(
      applicationId,
      "submission",
      validatedInput.contactEmail,
      { statusLookupUrl },
    );

    if (communicationId) {
      await dispatchLifecycleEmail(communicationId, {
        messageType: "submission",
        recipientEmail: validatedInput.contactEmail,
        applicantName: validatedInput.applicantFullName,
        organizationName: validatedInput.organizationName,
        statusLink: statusLookupUrl,
      });
    }
  } catch (error) {
    console.error("Submission communication dispatch failed:", error);
  }

  return {
    applicationId,
    createdNew: inserted.created_new,
    statusLookupToken,
    statusLookupUrl,
    statusLookupTokenExpiresAt: statusLookupTokenExpiresAt.toISOString(),
  };
}

export async function lookupOrganizerApplicationStatus(
  statusLookupToken: string,
  clientIp: string | null,
): Promise<StatusLookupResult> {
  const admin = createOrganizerAdminClient();

  const { data, error } = await admin.rpc("lookup_organizer_application_status", {
    p_status_lookup_token: statusLookupToken,
    p_client_ip: clientIp,
  });

  if (error) {
    if (isMissingOrganizerLifecycleRpc(error as SupabaseError, "lookup_organizer_application_status")) {
      return lookupOrganizerApplicationStatusFallback(admin, statusLookupToken);
    }

    throw error;
  }

  const row = (data as Array<{
    machine_code: "ok" | "not_found" | "throttled";
    status: "pending" | "approved" | "rejected" | null;
    rejection_reason: string | null;
    masked_contact_email: string | null;
  }> | null)?.[0];

  if (!row || row.machine_code === "not_found") {
    return { machineCode: "not_found" };
  }

  if (row.machine_code === "throttled") {
    return { machineCode: "throttled" };
  }

  if (!row.status || !row.masked_contact_email) {
    return { machineCode: "not_found" };
  }

  return {
    machineCode: "ok",
    status: row.status,
    rejectionReason: row.rejection_reason,
    maskedContactEmail: row.masked_contact_email,
  };
}

export async function processOrganizerDecisionHandoff(applicationId: string) {
  const application = await loadApplicationById(applicationId);

  if (!application || application.status === "pending") {
    return;
  }

  const contactEmail = application.contact_email?.toLowerCase();
  if (!contactEmail) {
    return;
  }

  if (application.status === "rejected") {
    const communicationId = await claimCommunication(application.id, "rejected", contactEmail, {
      rejectionReason: application.rejection_reason,
      statusLookupPath: "/organizer/status",
    });

    if (!communicationId) {
      return;
    }

    await dispatchLifecycleEmail(communicationId, {
      messageType: "rejected",
      recipientEmail: contactEmail,
      applicantName: application.applicant_full_name || "Organizer Applicant",
      organizationName: application.organization_name || "your organization",
      rejectionReason: application.rejection_reason,
      statusLink: `${getBaseUrl()}/organizer/status`,
    });

    return;
  }

  const { profileId, invitedIdentity } = await resolveProfileForApprovedApplication(application);

  const admin = createOrganizerAdminClient();
  const { data: provisionResult, error: provisionError } = await admin.rpc("provision_organizer_account", {
    p_application_id: application.id,
    p_profile_id: profileId,
  });

  if (provisionError) {
    throw provisionError;
  }

  const provisionRow = (provisionResult as Array<{ machine_code: string }> | null)?.[0];

  if (!provisionRow || provisionRow.machine_code !== "ok") {
    throw new Error(
      `Organizer provisioning failed with machine code: ${provisionRow?.machine_code || "unknown"}`,
    );
  }

  const communicationId = await claimCommunication(application.id, "approved", contactEmail, {
    statusLookupPath: "/organizer/status",
  });

  if (!communicationId) {
    return;
  }

  await sendApprovedActivation(application, communicationId, invitedIdentity);
}
