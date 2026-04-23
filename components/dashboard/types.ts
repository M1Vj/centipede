import type { CompetitionStatus } from "@/lib/competition/types";

export interface OrganizerDashboardMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: "default" | "success";
}

export interface OrganizerCompetitionRow {
  id: string;
  name: string;
  subtitle: string;
  status: CompetitionStatus;
  registrationCount: number;
  capacity: number | null;
  dateLabel: string;
  href: string;
}

export interface OrganizerCalendarEvent {
  id: string;
  title: string;
  date: string;
}

export interface OrganizerActivityItem {
  id: string;
  message: string;
  timestampLabel: string;
  tone: "success" | "info" | "default";
}
