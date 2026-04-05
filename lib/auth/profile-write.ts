"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SaveProfileParams = {
  fullName: string;
  gradeLevel: string;
  school: string;
};

/**
 * Server Action to save or update a user profile.
 * Uses the Admin client to bypass client-side RLS hangs.
 */
export async function saveProfile({
  fullName,
  gradeLevel,
  school,
}: SaveProfileParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const serverUserId = user.id;
  const serverEmail = user.email?.toLowerCase().trim();

  if (!serverEmail) {
    throw new Error("Authenticated user email is required.");
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Admin client configuration missing.");
  }

  // 1. Double-check required fields
  if (!fullName.trim() || !school.trim() || !gradeLevel.trim()) {
    throw new Error("All profile fields are required.");
  }

  // 2. Perform upsert using service role
  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: serverUserId,
        email: serverEmail,
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

  if (error) {
    throw new Error(error.message);
  }

  return { success: true, profile: data };
}
