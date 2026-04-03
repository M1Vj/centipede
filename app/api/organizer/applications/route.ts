import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { submitOrganizerApplication } from "@/lib/organizer/lifecycle";
import { createClient } from "@/lib/supabase/server";

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
            message: "Suspended users cannot submit organizer applications.",
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
    const message = getErrorMessage(
      error,
      "Unable to submit organizer application.",
    );

    return NextResponse.json(
      {
        code: "submission_failed",
        message,
      },
      { status: 400 },
    );
  }
}
