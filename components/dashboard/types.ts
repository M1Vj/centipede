export type OrganizerDashboardMetricTone = "default" | "success";

export type OrganizerDashboardMetric = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: OrganizerDashboardMetricTone;
};

export type OrganizerCompetitionRow = {
  id: string;
  name: string;
  subtitle: string;
  status: "draft" | "published" | "live" | "paused" | "ended" | "archived";
  registrationCount: number;
  capacity?: number | null;
  dateLabel: string;
  href: string;
};

export type OrganizerCalendarEvent = {
  id: string;
  title: string;
  date: string;
};

export type OrganizerActivityItem = {
  id: string;
  message: string;
  timestampLabel: string;
  tone: "default" | "success" | "info";
};
