export type TeamRecord = {
  id: string;
  name: string;
  teamCode: string;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamListMembership = {
  role: string;
  joinedAt: string;
  isLeader: boolean;
};

export type TeamListEntry = TeamRecord & {
  membership: TeamListMembership;
};

export type TeamListResponse = {
  code: string;
  teams: TeamListEntry[];
};

export type TeamMembershipRecord = {
  id: string;
  teamId: string;
  profileId: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
};

export type TeamMemberProfile = {
  id: string;
  fullName: string | null;
  school: string | null;
  gradeLevel: string | null;
};

export type TeamRosterMember = TeamMembershipRecord & {
  profile: TeamMemberProfile | null;
};

export type TeamDetailResponse = {
  code: string;
  team: TeamRecord;
  membership: TeamMembershipRecord;
  members: TeamRosterMember[];
};

export type TeamInvite = {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  team: TeamRecord | null;
  inviter: TeamMemberProfile | null;
};

export type TeamPendingInvite = {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  invitee: TeamMemberProfile | null;
};

export type TeamInvitesResponse = {
  code: string;
  invites: TeamInvite[];
};

export type TeamPendingInvitesResponse = {
  code: string;
  invites: TeamPendingInvite[];
};
