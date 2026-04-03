"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

function createOrganizerAdminClient() {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseEnv();

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for organizer settings.");
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function saveOrganizerProfile(input: {
  fullName: string;
  organization: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const fullName = input.fullName.trim();
  const organization = input.organization.trim();

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!organization) {
    throw new Error("Organization is required.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, organization })
    .eq("id", user.id)
    .eq("role", "organizer");

  if (error) {
    throw new Error(error.message);
  }
}

export async function saveOrganizerSettings(input: {
  contactPhone: string;
  organizationType: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const contactPhone = input.contactPhone.trim();
  const organizationType = input.organizationType.trim();

  if (!contactPhone) {
    throw new Error("Contact phone is required.");
  }

  if (!organizationType) {
    throw new Error("Organization type is required.");
  }

  const admin = createOrganizerAdminClient();

  const { data: latestApplication, error: latestApplicationError } = await admin
    .from("organizer_applications")
    .select("id")
    .eq("profile_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (latestApplicationError) {
    throw new Error(latestApplicationError.message);
  }

  if (!latestApplication) {
    throw new Error("Organizer application record was not found.");
  }

  const { error: updateError } = await admin
    .from("organizer_applications")
    .update({
      contact_phone: contactPhone,
      organization_type: organizationType,
    })
    .eq("id", latestApplication.id)
    .eq("profile_id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function getOrganizerSettingsSnapshot(profileId: string) {
  const admin = createOrganizerAdminClient();

  const { data, error } = await admin
    .from("organizer_applications")
    .select("contact_phone, organization_type")
    .eq("profile_id", profileId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ contact_phone: string | null; organization_type: string | null }>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    contactPhone: data?.contact_phone ?? "",
    organizationType: data?.organization_type ?? "",
  };
}
