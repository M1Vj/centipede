"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { formatDate, requestJson } from "@/components/teams/utils";
import type { TeamListEntry, TeamListResponse } from "@/components/teams/types";

export function TeamList() {
  const [teams, setTeams] = useState<TeamListEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState("Unable to load teams.");
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadTeams = async () => {
      setStatus("loading");
      const result = await requestJson<TeamListResponse>("/api/mathlete/teams");

      if (!isActive) {
        return;
      }

      if (!result.ok || !result.payload) {
        setErrorMessage(result.message || "Unable to load teams.");
        setStatus("error");
        return;
      }

      setTeams(result.payload.teams ?? []);
      setStatus("ready");
    };

    void loadTeams();

    return () => {
      isActive = false;
    };
  }, [refreshIndex]);

  if (status === "loading") {
    return (
      <LoadingState
        title="Loading teams"
        description="Fetching your team roster and membership details."
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Unable to load teams"
        description={errorMessage}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => setRefreshIndex((value) => value + 1)}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (teams.length === 0) {
    return (
      <EmptyState
        title="No teams yet"
        description="Create a team or join with a code to start collaborating."
        action={
          <Button asChild>
            <ProgressLink href="/mathlete/teams/create">Create team</ProgressLink>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      {teams.map((team) => {
        const isLeader = team.membership?.isLeader;

        return (
          <Card key={team.id} className="border-border/60 bg-background/90 shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{team.name}</CardTitle>
                  <CardDescription>
                    Joined {formatDate(team.membership?.joinedAt)}
                  </CardDescription>
                </div>
                <Badge variant={isLeader ? "default" : "secondary"}>
                  {isLeader ? "Leader" : "Member"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Team code:{" "}
                <span className="font-semibold text-foreground">{team.teamCode}</span>
              </div>
              <Button asChild size="sm" variant="outline">
                <ProgressLink href={`/mathlete/teams/${team.id}`}>View team</ProgressLink>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
