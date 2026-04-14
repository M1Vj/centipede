import { describe, expect, test } from "vitest";

type Membership = {
  profileId: string;
  joinedAt: string;
  isActive: boolean;
};

function selectNextLeader(sortedMemberships: Membership[]): Membership | null {
  return sortedMemberships.find((member) => member.isActive) ?? null;
}

describe("leadership transfer selection", () => {
  test("chooses the earliest active member from a sorted roster", () => {
    const roster: Membership[] = [
      {
        profileId: "leader-1",
        joinedAt: "2024-01-01T00:00:00Z",
        isActive: false,
      },
      {
        profileId: "member-early",
        joinedAt: "2024-01-02T00:00:00Z",
        isActive: true,
      },
      {
        profileId: "member-late",
        joinedAt: "2024-02-01T00:00:00Z",
        isActive: true,
      },
    ];

    const nextLeader = selectNextLeader(roster);

    expect(nextLeader?.profileId).toBe("member-early");
  });

  test("returns null when no active members remain", () => {
    const roster: Membership[] = [
      {
        profileId: "member-1",
        joinedAt: "2024-01-01T00:00:00Z",
        isActive: false,
      },
    ];

    const nextLeader = selectNextLeader(roster);

    expect(nextLeader).toBeNull();
  });
});
