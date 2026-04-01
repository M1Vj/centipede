export type ProfileCompletionFields = {
  full_name?: string | null;
  school?: string | null;
  grade_level?: string | null;
};

export type AuthProfile = ProfileCompletionFields & {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};

export const PROFILE_SELECT_FIELDS =
  "id, email, full_name, school, grade_level, role, is_active";

function hasContent(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function isProfileComplete(profile: ProfileCompletionFields | null | undefined) {
  if (!profile) {
    return false;
  }

  return (
    hasContent(profile.full_name) &&
    hasContent(profile.school) &&
    hasContent(profile.grade_level)
  );
}
