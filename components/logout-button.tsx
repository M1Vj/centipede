"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { createClient } from "@/lib/supabase/client";

type LogoutButtonProps = Omit<ButtonProps, "children" | "onClick" | "pending" | "pendingText"> & {
  label?: string;
  ariaLabel?: string;
};

export function LogoutButton({
  label = "Logout",
  ariaLabel,
  ...props
}: LogoutButtonProps = {}) {
  const feedbackRouter = useFeedbackRouter();
  const [isPending, setIsPending] = useState(false);
  const buttonProps = ariaLabel ? { ...props, "aria-label": ariaLabel } : props;

  const logout = async () => {
    setIsPending(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      feedbackRouter.push("/auth/login");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button onClick={() => void logout()} pending={isPending} pendingText="Logging out..." {...buttonProps}>
      {label}
    </Button>
  );
}
