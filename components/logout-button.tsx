"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useState } from "react";

type LogoutButtonProps = {
  label?: string;
  ariaLabel?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export function LogoutButton({
  label = "Logout",
  ariaLabel,
  className,
  variant,
  size,
}: LogoutButtonProps = {}) {
  const [isPending, setIsPending] = useState(false);

  const logout = async () => {
    setIsPending(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/auth/login");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      onClick={() => void logout()}
      pending={isPending}
      pendingText="Logging out..."
      aria-label={ariaLabel}
      className={className}
      variant={variant}
      size={size}
    >
      {label}
    </Button>
  );
}
