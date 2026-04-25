"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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

const landingAnchors = [
  { id: "product", label: "Product" },
  { id: "features", label: "Features" },
  { id: "methodology", label: "Methodology" },
  { id: "pricing", label: "Pricing" },
];

export function HeaderAuthNav() {
  const { isLoading, profile, user, signOut } = useAuth();
  const pathname = usePathname();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const onHomeRoute = pathname === "/";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setIsConfirmOpen(false);
    await signOut();
    setIsSigningOut(false);
  };

  return (
    <>
      <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
        {!user ? (
          <div className="hidden items-center gap-1.5 lg:flex">
            {landingAnchors.map((item) => (
              <ProgressLink
                key={item.id}
                href={onHomeRoute ? `#${item.id}` : `/#${item.id}`}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
              >
                {item.label}
              </ProgressLink>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-28 rounded-full bg-white/15" />
            <Skeleton className="h-9 w-24 rounded-full bg-white/15" />
          </div>
        ) : user ? (
          <>
            <div className="hidden rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100 sm:block">
              {getDisplayLabel(
                profile?.full_name,
                user.user_metadata.full_name ?? user.email ?? undefined,
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/25 bg-white/5 text-slate-100 hover:bg-white/15 hover:text-white"
              onClick={() => setIsConfirmOpen(true)}
            >
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-slate-100 hover:bg-white/10 hover:text-white"
            >
              <ProgressLink href="/auth/login">Login</ProgressLink>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-[#f49700] text-[#0f172a] shadow-[0_18px_42px_-24px_rgba(244,151,0,0.9)] hover:bg-[#f6ac2c]"
            >
              <ProgressLink href="/auth/sign-up">Start Free Trial</ProgressLink>
            </Button>
          </>
        )}

        <ThemeSwitcher
          buttonClassName="text-slate-100 hover:bg-white/10 hover:text-white"
          iconClassName="text-slate-200"
        />
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

      <Dialog open={isSigningOut}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-sm border-border/70 bg-background/95 p-8"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Spinner className="size-6 text-primary" />
            </div>
            <DialogTitle>Signing out</DialogTitle>
            <DialogDescription>
              Please wait while we securely sign you out of your account.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
