"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const redirectAfterLogin = async (userId: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    router.push(isProfileComplete(data) ? "/" : "/profile/complete");
    router.refresh();
  };

  const handleGoogle = async () => {
    const supabase = getSupabaseClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm?next=/profile/complete`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to start Google login.",
      );
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    setIsLoading(true);
    setError(null);

    try {
      await supabase.auth.signOut({ scope: "local" });

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Login succeeded but no user session was returned.");
      }

      await redirectAfterLogin(user.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in with Google or use your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoogle()}
              disabled={isLoading}
            >
              Continue with Google
            </Button>
          </div>

          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login with email"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
