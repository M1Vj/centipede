"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useState } from "react";

type LogoutButtonProps = Omit<ButtonProps, "children" | "onClick" | "pending" | "pendingText"> & {
  label?: string;
};

export function LogoutButton({ label = "Logout", ...props }: LogoutButtonProps) {
  const feedbackRouter = useFeedbackRouter();
  const [isPending, setIsPending] = useState(false);

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
    <Button onClick={() => void logout()} pending={isPending} pendingText="Logging out..." {...props}>
      {label}
    </Button>
  );
}
