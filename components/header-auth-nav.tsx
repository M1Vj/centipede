"use client";

import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressLink } from "@/components/ui/progress-link";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setIsConfirmOpen(false);
    await signOut();
    setIsSigningOut(false);
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
        open={isConfirmOpen && !isSigningOut}
        onOpenChange={setIsConfirmOpen}
        title="Sign out now?"
        description="You will need to authenticate again before accessing protected routes and profile-aware areas."
        confirmLabel="Sign out"
        pending={isSigningOut}
        pendingLabel="Signing out..."
        onConfirm={handleSignOut}
      />

      <AlertDialog.Root open={isSigningOut}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[100] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 outline-none transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95">
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/70 bg-background/95 p-8 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Spinner className="size-6 text-primary" />
              </div>
              <AlertDialog.Title className="text-xl font-semibold tracking-tight text-foreground">
                Signing out
              </AlertDialog.Title>
              <AlertDialog.Description className="text-center text-sm text-muted-foreground">
                Please wait while we securely sign you out of your account.
              </AlertDialog.Description>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
