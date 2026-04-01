"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressLink } from "@/components/ui/progress-link";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    setIsSigningOut(true);
    setIsConfirmOpen(false);
    signOut();
  };

  return (
    <>
      <nav className="flex flex-wrap items-center justify-end gap-2">
      {!user && (
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <ProgressLink href="/">Home</ProgressLink>
        </Button>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-40 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      ) : user ? (
        <>
          <div className="hidden rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm text-foreground sm:block">
            {getDisplayLabel(
              profile?.full_name,
              user.user_metadata.full_name ?? user.email ?? undefined,
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsConfirmOpen(true)}>
            Sign out
          </Button>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm">
            <ProgressLink href="/auth/login">Login</ProgressLink>
          </Button>
          <Button
            asChild
            size="sm"
            className="shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.85)]"
          >
            <ProgressLink href="/auth/sign-up">Register</ProgressLink>
          </Button>
        </>
      )}

      <ThemeSwitcher />
      </nav>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Sign out now?"
        description="You will need to authenticate again before accessing protected routes and profile-aware areas."
        confirmLabel="Sign out"
        pending={isSigningOut}
        pendingLabel="Signing out..."
        onConfirm={handleSignOut}
      />
    </>
  );
}
