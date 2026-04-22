import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompetitionType } from "@/lib/scoring/types";
import type { CompetitionFormat, CompetitionRecord, CompetitionStatus } from "@/lib/competition/types";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";

export const DISCOVERABLE_COMPETITION_STATUSES = ["published", "live", "paused"] as const;
export type DiscoverableCompetitionStatus = (typeof DISCOVERABLE_COMPETITION_STATUSES)[number];

export type CompetitionSearchFilters = {
  query: string;
  type: "all" | CompetitionType;
  format: "all" | CompetitionFormat;
  status: "all" | DiscoverableCompetitionStatus;
};

export type DiscoverableCompetition = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: CompetitionType;
  format: CompetitionFormat;
  status: CompetitionStatus;
  registrationStart: string | null;
  registrationEnd: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  attemptsAllowed: number;
  maxParticipants: number | null;
  participantsPerTeam: number | null;
  maxTeams: number | null;
};

export type DiscoverableCompetitionResult = {
  competitions: DiscoverableCompetition[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  filters: CompetitionSearchFilters;
};

export const COMPETITION_PAGE_SIZE = 25;

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeQuery(value: string) {
  return value.trim().slice(0, 120);
}

function parsePage(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 1;
}

export function parseCompetitionSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): { filters: CompetitionSearchFilters; page: number; pageSize: number } {
  const query = normalizeQuery(getSearchParamValue(searchParams.q));
  const type = getSearchParamValue(searchParams.type);
  const format = getSearchParamValue(searchParams.format);
  const status = getSearchParamValue(searchParams.status);
  const page = parsePage(getSearchParamValue(searchParams.page));

  return {
    filters: {
      query,
      type: type === "open" || type === "scheduled" ? (type as CompetitionType) : "all",
      format: format === "team" || format === "individual" ? format : "all",
      status:
        status === "published" || status === "live" || status === "paused"
          ? status
          : "all",
    },
    page,
    pageSize: COMPETITION_PAGE_SIZE,
  };
}

export function buildCompetitionSearchParams(filters: CompetitionSearchFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("q", filters.query);
  }

  if (filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (filters.format !== "all") {
    params.set("format", filters.format);
  }

  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  return params;
}

function mapCompetitionRecord(competition: CompetitionRecord): DiscoverableCompetition {
  return {
    id: competition.id,
    name: competition.name,
    description: competition.description,
    instructions: competition.instructions,
    type: competition.type,
    format: competition.format,
    status: competition.status,
    registrationStart: competition.registrationStart,
    registrationEnd: competition.registrationEnd,
    startTime: competition.startTime,
    endTime: competition.endTime,
    durationMinutes: competition.durationMinutes,
    attemptsAllowed: competition.attemptsAllowed,
    maxParticipants: competition.maxParticipants,
    participantsPerTeam: competition.participantsPerTeam,
    maxTeams: competition.maxTeams,
  };
}

function applyPostFilters(competitions: CompetitionRecord[], filters: CompetitionSearchFilters) {
  return competitions.filter((competition) => {
    if (competition.isDeleted) {
      return false;
    }

    if (!DISCOVERABLE_COMPETITION_STATUSES.includes(competition.status as DiscoverableCompetitionStatus)) {
      return false;
    }

    if (filters.status !== "all" && competition.status !== filters.status) {
      return false;
    }

    if (filters.type !== "all" && competition.type !== filters.type) {
      return false;
    }

    if (filters.format !== "all" && competition.format !== filters.format) {
      return false;
    }

    if (filters.query) {
      const text = `${competition.name} ${competition.description}`.toLowerCase();
      if (!text.includes(filters.query.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

export async function fetchDiscoverableCompetitions(
  supabase: SupabaseClient,
  filters: CompetitionSearchFilters,
  page: number,
  pageSize: number = COMPETITION_PAGE_SIZE,
): Promise<DiscoverableCompetitionResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const searchValue = filters.query.trim();

  const queryBuilder = supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS, { count: "exact" })
    .eq("is_deleted", false)
    .in("status", DISCOVERABLE_COMPETITION_STATUSES)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.type !== "all") {
    queryBuilder.eq("type", filters.type);
  }

  if (filters.format !== "all") {
    queryBuilder.eq("format", filters.format);
  }

  if (filters.status !== "all") {
    queryBuilder.eq("status", filters.status);
  }

  if (searchValue) {
    queryBuilder.or(`name.ilike.%${searchValue}%,description.ilike.%${searchValue}%`);
  }

  const primaryResult = await queryBuilder.range(from, to);

  if (!primaryResult.error) {
    const competitions = (primaryResult.data ?? [])
      .map((row) => normalizeCompetitionRecord(row))
      .filter((row): row is CompetitionRecord => row !== null)
      .map(mapCompetitionRecord);

    const total = primaryResult.count ?? competitions.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    return {
      competitions,
      total,
      page,
      pageCount,
      pageSize,
      filters,
    };
  }

  if (!isLegacyCompetitionSelectError(primaryResult.error)) {
    throw primaryResult.error;
  }

  const fallbackBuilder = supabase
    .from("competitions")
    .select(LEGACY_COMPETITION_SELECT_COLUMNS, { count: "exact" })
    .eq("published", true)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.type !== "all") {
    fallbackBuilder.eq("type", filters.type);
  }

  if (filters.format !== "all") {
    fallbackBuilder.eq("format", filters.format);
  }

  if (searchValue) {
    fallbackBuilder.or(`name.ilike.%${searchValue}%,description.ilike.%${searchValue}%`);
  }

  const fallbackResult = await fallbackBuilder.range(from, to);

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  const normalized = (fallbackResult.data ?? [])
    .map((row) => normalizeCompetitionRecord(row))
    .filter((row): row is CompetitionRecord => row !== null);
  const filtered = applyPostFilters(normalized, filters);
  const competitions = filtered.map(mapCompetitionRecord);
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    competitions,
    total,
    page,
    pageCount,
    pageSize,
    filters,
  };
}
