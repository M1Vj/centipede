import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { submitOrganizerApplication } from "@/lib/organizer/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const KNOWN_SUBMISSION_ERRORS = new Set([
  "Applicant full name is required.",
  "Organization name is required.",
  "A valid contact email is required.",
  "Contact phone is required.",
  "Organization type is required.",
  "Organizer statement is required.",
  "You must accept the Data Privacy Act of 2012 and Terms & Conditions.",
  "Only JPEG and PNG logo files are allowed.",
  "Logo file size must be 2MB or less.",
  "Unsupported logo file type.",
  "Organizer applications are temporarily unavailable. Please try again later.",
]);

function toSubmissionErrorPayload(error: unknown) {
  const message = getErrorMessage(error, "Unable to submit organizer application.");

  if (KNOWN_SUBMISSION_ERRORS.has(message)) {
    const status = message === "Organizer applications are temporarily unavailable. Please try again later."
      ? 503
      : 400;

    return { message, status };
  }

  return {
    message: "Unable to submit organizer application.",
    status: 500,
  };
}

function toBoolean(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.toLowerCase() === "true";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profileId: string | null = null;

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", user.id)
        .maybeSingle<{ id: string; role: string; is_active: boolean }>();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.is_active === false) {
        return NextResponse.json(
          {
            code: "suspended",
            message: "This account is inactive or pending approval. Additional applications cannot be submitted at this time.",
          },
          { status: 403 },
        );
      }

      if (profile?.role === "organizer") {
        return NextResponse.json(
          {
            code: "already_organizer",
            message: "This account is already an organizer.",
          },
          { status: 409 },
        );
      }

      profileId = profile?.id ?? user.id;
    }

    const contactEmail = String(formData.get("contactEmail") ?? "").trim();
    if (contactEmail) {
      const duplicateCheckWindow = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const adminSupabase = createAdminClient();
      if (adminSupabase) {
        const { count: recentCount, error: recentError } = await adminSupabase
          .from("organizer_applications")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .ilike("contact_email", contactEmail)
          .gt("submitted_at", duplicateCheckWindow);

        if (recentError) {
          throw recentError;
        }

        if (recentCount && recentCount > 0) {
          return NextResponse.json(
            {
              code: "too_many_requests",
              message: "Application actively pending. Please check your existing status token before submitting again.",
            },
            { status: 429 },
          );
        }
      }
    }

    const logoEntry = formData.get("logo");
    const logoFile = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;

    const result = await submitOrganizerApplication({
      applicantFullName: String(formData.get("applicantFullName") ?? ""),
      organizationName: String(formData.get("organizationName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      organizationType: String(formData.get("organizationType") ?? ""),
      statement: String(formData.get("statement") ?? ""),
      hasAcceptedDataPrivacyAct: toBoolean(formData.get("hasAcceptedDataPrivacyAct")),
      hasAcceptedTerms: toBoolean(formData.get("hasAcceptedTerms")),
      logoFile,
      profileId,
    });

    return NextResponse.json({
      code: "submitted",
      applicationId: result.applicationId,
      createdNew: result.createdNew,
      statusLookupToken: result.statusLookupToken,
      statusLookupUrl: result.statusLookupUrl,
      statusLookupTokenExpiresAt: result.statusLookupTokenExpiresAt,
    });
  } catch (error) {
    const { message, status } = toSubmissionErrorPayload(error);

    return NextResponse.json(
      {
        code: "submission_failed",
        message,
      },
      { status },
    );
  }
}
