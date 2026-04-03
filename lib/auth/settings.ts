"use server";

import { createClient } from "@/lib/supabase/server";

type SaveMathleteSettingsInput = {
  school: string;
  gradeLevel: string;
};

export async function saveMathleteSettings({
  school,
  gradeLevel,
}: SaveMathleteSettingsInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const normalizedSchool = school.trim();
  const normalizedGradeLevel = gradeLevel.trim();

  if (!normalizedSchool || !normalizedGradeLevel) {
    throw new Error("School and grade level are required.");
  }

  const { data, error } = await supabase.rpc("update_mathlete_profile_settings", {
    profile_id: user.id,
    next_school: normalizedSchool,
    next_grade_level: normalizedGradeLevel,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
