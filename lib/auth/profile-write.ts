type ProfileWriteClient = {
  from: (table: "profiles") => {
    upsert: (
      values: {
        id: string;
        email: string;
        full_name: string;
        school: string;
        grade_level: string;
      },
      options: {
        onConflict: "id";
      },
    ) => PromiseLike<{
      error: Error | null;
    }>;
  };
};

type SaveProfileParams = {
  client: ProfileWriteClient;
  email: string;
  fullName: string;
  gradeLevel: string;
  school: string;
  userId: string;
};

export async function saveProfile({
  client,
  email,
  fullName,
  gradeLevel,
  school,
  userId,
}: SaveProfileParams) {
  const { error } = await client.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName.trim(),
      school: school.trim(),
      grade_level: gradeLevel.trim(),
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw error;
  }
}
