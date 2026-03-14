"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile } from "@/lib/auth/profile-write";
import { getErrorMessage } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { AuthProfile } from "@/lib/auth/profile";

type ProfileCompletionFormProps = {
  profile: AuthProfile | null;
  userEmail: string;
  userId: string;
};

export function ProfileCompletionForm({
  profile,
  userEmail,
  userId,
}: ProfileCompletionFormProps) {
  const feedbackRouter = useFeedbackRouter();
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [school, setSchool] = useState(profile?.school ?? "");
  const [gradeLevel, setGradeLevel] = useState(profile?.grade_level ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{
    message: string | null;
    type: "error" | "pending";
  }>({
    message: null,
    type: "pending",
  });
  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus({
      message: "Saving your profile...",
      type: "pending",
    });

    try {
      const supabase = getSupabaseClient();
      await saveProfile({
        client: supabase,
        userId,
        email: userEmail,
        fullName,
        school,
        gradeLevel,
      });

      await refreshProfile();
      feedbackRouter.push("/");
    } catch (nextError: unknown) {
      setStatus({
        message: getErrorMessage(nextError, "Unable to save profile."),
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border/70 bg-background/90 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Complete your profile</CardTitle>
        <CardDescription>
          Tell Mathwiz Arena who you are before entering protected areas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
          aria-busy={isSaving}
          aria-describedby={status.message ? statusId : undefined}
        >
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="school">School</Label>
            <Input
              id="school"
              autoComplete="organization"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grade_level">Grade level</Label>
            <Input
              id="grade_level"
              value={gradeLevel}
              onChange={(event) => setGradeLevel(event.target.value)}
              required
            />
          </div>

          <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
            <FormStatusMessage
              status={status.type}
              message={status.message}
              icon={status.type === "error" ? CircleAlert : undefined}
            />
          </div>

          <Button type="submit" className="w-full" pending={isSaving} pendingText="Saving profile...">
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
