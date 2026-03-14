"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useState } from "react";

export function LogoutButton() {
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
    <Button onClick={() => void logout()} pending={isPending} pendingText="Logging out...">
      Logout
    </Button>
  );
}
