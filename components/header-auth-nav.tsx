"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";

function getDisplayLabel(fullName: string | null | undefined, fallback: string | undefined) {
  if (fullName?.trim()) {
    return fullName.trim();
  }

  return fallback ?? "Account";
}

export function HeaderAuthNav() {
  const { isLoading, profile, user, signOut } = useAuth();

  return (
    <nav className="flex flex-wrap items-center justify-end gap-2">
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/">Home</Link>
      </Button>

      {isLoading ? (
        <div className="h-9 w-48 rounded-full border border-border/70 bg-background/70" />
      ) : user ? (
        <>
          <div className="rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm text-foreground">
            {getDisplayLabel(
              profile?.full_name,
              user.user_metadata.full_name ?? user.email ?? undefined,
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/login">Login</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.85)]"
          >
            <Link href="/auth/sign-up">Register</Link>
          </Button>
        </>
      )}

      <ThemeSwitcher />
    </nav>
  );
}
