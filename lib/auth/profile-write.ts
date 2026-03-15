"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type SaveProfileParams = {
  fullName: string;
  gradeLevel: string;
  school: string;
  userId: string;
  email: string;
};

/**
 * Server Action to save or update a user profile.
 * Uses the Admin client to bypass client-side RLS hangs.
 */
export async function saveProfile({
  fullName,
  gradeLevel,
  school,
  userId,
  email,
}: SaveProfileParams) {
  console.log("[saveProfile] Server Action starting for userId:", userId);

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Admin client configuration missing.");
  }

  // 1. Double-check required fields
  if (!fullName.trim() || !school.trim() || !gradeLevel.trim()) {
    throw new Error("All profile fields are required.");
  }

  // 2. Perform upsert using service role
  const { data, error, status, statusText } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        school: school.trim(),
        grade_level: gradeLevel.trim(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    )
    .select()
    .single();

  console.log("[saveProfile] Database response:", { status, statusText, error, data });

  if (error) {
    console.error("[saveProfile] Upsert error:", error);
    throw new Error(error.message);
  }

  return { success: true, profile: data };
}
