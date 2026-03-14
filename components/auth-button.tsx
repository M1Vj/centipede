import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { ProgressLink } from "./ui/progress-link";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <ProgressLink href="/auth/login">Sign in</ProgressLink>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <ProgressLink href="/auth/sign-up">Sign up</ProgressLink>
      </Button>
    </div>
  );
}
