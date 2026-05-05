"use client";

import { useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnnouncementAudience } from "@/components/monitoring/types";

type AnnouncementComposerProps = {
  competitionId: string;
};

async function readResponseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body?.code === "string" && body.code.trim() && !response.ok) {
    return `${fallback} (${body.code})`;
  }

  return fallback;
}

export function AnnouncementComposer({ competitionId }: AnnouncementComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !pending;

  async function submitAnnouncement() {
    if (!canSubmit) {
      return;
    }

    setPending(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/organizer/competitions/${competitionId}/monitoring/announce`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, "Announcement failed."));
      }

      setTitle("");
      setBody("");
      setAudience("all");
      setStatusMessage("Announcement queued for delivery.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Announcement failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
          <Megaphone className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#10182b]">Announcement composer</h2>
          <p className="mt-1 text-sm text-slate-500">
            Messages are scoped to this competition before delivery fan-out.
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5">
        <div className="grid gap-2">
          <Label htmlFor="announcement-title">Announcement title</Label>
          <Input
            id="announcement-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Operational update"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="announcement-body">Announcement body</Label>
          <textarea
            id="announcement-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Write concise instruction participants can act on."
            required
          />
        </div>

        <div className="grid gap-2 md:max-w-xs">
          <Label htmlFor="announcement-audience">Audience</Label>
          <select
            id="announcement-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            required
          >
            <option value="all">All participants</option>
            <option value="registered">Registered only</option>
            <option value="active">Active attempts</option>
            <option value="flagged">Flagged attempts</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submitAnnouncement} disabled={!canSubmit} pending={pending}>
            <Send className="size-4" />
            Send announcement
          </Button>
          {statusMessage ? (
            <p role="status" className="text-sm font-semibold text-emerald-700">
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
