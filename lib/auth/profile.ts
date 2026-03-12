export type ProfileCompletionFields = {
  full_name?: string | null;
  school?: string | null;
  grade_level?: string | null;
};

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
