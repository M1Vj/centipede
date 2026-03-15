type EmailConfirmationClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: {
          id: string;
        } | null;
      };
      error: Error | null;
    }>;
  };
};

type ResolveEmailConfirmationRedirectParams = {
  client: EmailConfirmationClient;
  next: string | null | undefined;
};

export async function resolveEmailConfirmationRedirect({
  client,
  next,
}: ResolveEmailConfirmationRedirectParams) {
  const safeNext = next?.startsWith("/") ? next : "/";
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("We couldn't finish signing you in from the email link.");
  }

  return safeNext;
}
