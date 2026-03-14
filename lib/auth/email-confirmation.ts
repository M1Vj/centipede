type EmailConfirmationClient = {
  auth: {
    getSession: () => Promise<{
      data: {
        session: {
          user?: {
            id: string;
          } | null;
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
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session?.user) {
    throw new Error("We couldn't finish signing you in from the email link.");
  }

  return safeNext;
}
