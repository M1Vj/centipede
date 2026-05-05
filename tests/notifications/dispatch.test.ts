import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dispatchCompetitionNotification,
  getDefaultNotificationPreferences,
  getNotificationChannelClass,
  getNotificationPreferenceKey,
  normalizeNotificationEventType,
  sanitizeNotificationLinkPath,
} from "@/lib/notifications/dispatch";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const RECIPIENT_ID = "11111111-1111-1111-1111-111111111111";
const COMPETITION_ID = "22222222-2222-2222-2222-222222222222";

function makeAdminClient(rpc = vi.fn()) {
  return { rpc };
}

describe("notification dispatch helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("maps existing producer aliases to canonical guide event types", () => {
    expect(normalizeNotificationEventType("competition_leaderboard_published")).toBe(
      "leaderboard_published",
    );
    expect(normalizeNotificationEventType("competition_problem_dispute_resolved")).toBe(
      "dispute_resolved",
    );
  });

  test("maps canonical events to one preference key and one channel class", () => {
    expect(getNotificationPreferenceKey("competition_announcement_posted")).toBe("announcements");
    expect(getNotificationPreferenceKey("leaderboard_published")).toBe("leaderboard_publication");
    expect(getNotificationPreferenceKey("score_recalculated")).toBe("score_recalculation");
    expect(getNotificationPreferenceKey("organizer_application_approved")).toBe("organizer_decisions");

    expect(getNotificationChannelClass("score_recalculated")).toBe("in_app_only");
    expect(getNotificationChannelClass("competition_announcement_posted")).toBe("email_eligible");
    expect(getNotificationChannelClass("leaderboard_published")).toBe("email_eligible");
  });

  test("uses deterministic notification preference defaults", () => {
    expect(getDefaultNotificationPreferences()).toEqual({
      inAppEnabled: true,
      emailEnabled: false,
      teamInvites: true,
      registrationReminders: true,
      announcements: true,
      leaderboardPublication: true,
      scoreRecalculation: true,
      organizerDecisions: true,
    });
  });

  test("allows only canonical internal notification link targets", () => {
    expect(sanitizeNotificationLinkPath(`/mathlete/competition/${COMPETITION_ID}/leaderboard`)).toBe(
      `/mathlete/competition/${COMPETITION_ID}/leaderboard`,
    );
    expect(sanitizeNotificationLinkPath("/organizer/status")).toBe("/organizer/status");
    expect(sanitizeNotificationLinkPath("https://example.com/phish")).toBeNull();
    expect(sanitizeNotificationLinkPath("/admin/users")).toBeNull();
    expect(sanitizeNotificationLinkPath(`/mathlete/competition/not-a-uuid/leaderboard`)).toBeNull();
  });

  test("dispatches canonical competition notifications through enqueue_notification with metadata-only email decision", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        notification_id: "33333333-3333-3333-3333-333333333333",
        inserted: true,
      }],
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(rpc) as never);

    const result = await dispatchCompetitionNotification({
      event: "competition_leaderboard_published",
      eventIdentityKey: "leaderboard_published:competition-1",
      recipientId: RECIPIENT_ID,
      actorId: "44444444-4444-4444-4444-444444444444",
      competitionId: COMPETITION_ID,
      linkPath: `/mathlete/competition/${COMPETITION_ID}/leaderboard`,
      metadata: {
        requestIdempotencyToken: "idem-1",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      eventIdentityKey: "leaderboard_published:competition-1",
      eventType: "leaderboard_published",
      channelClass: "email_eligible",
      email: { eligible: true, attempted: false, reason: "provider_not_configured" },
    });
    expect(rpc).toHaveBeenCalledWith("enqueue_notification", {
      p_recipient_id: RECIPIENT_ID,
      p_type: "leaderboard_published",
      p_title: "Leaderboard published",
      p_body: "A competition leaderboard is now available.",
      p_link_path: `/mathlete/competition/${COMPETITION_ID}/leaderboard`,
      p_event_identity_key: "leaderboard_published:competition-1",
      p_metadata_json: expect.objectContaining({
        channelClass: "email_eligible",
        preferenceKey: "leaderboard_publication",
        email: {
          eligible: true,
          attempted: false,
          reason: "provider_not_configured",
        },
        requestIdempotencyToken: "idem-1",
      }),
    });
  });

  test("invalid event types reject before admin RPC side effects", async () => {
    const rpc = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(rpc) as never);

    const result = await dispatchCompetitionNotification({
      event: "competition_export_job_queued",
      eventIdentityKey: "export:1",
      recipientId: RECIPIENT_ID,
      competitionId: COMPETITION_ID,
    } as never);

    expect(result).toMatchObject({
      ok: false,
      eventIdentityKey: "export:1",
      error: "invalid_event_type",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
