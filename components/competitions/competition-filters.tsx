"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildCompetitionSearchParams,
  type CompetitionSearchFilters,
} from "@/lib/competition/discovery";

type CompetitionFiltersProps = {
  actionPath: string;
  filters: CompetitionSearchFilters;
  total: number;
};

const SEARCH_DEBOUNCE_MS = 300;

function buildFilterHref(actionPath: string, filters: CompetitionSearchFilters) {
  const params = buildCompetitionSearchParams(filters, 1);
  const queryString = params.toString();

  return queryString ? `${actionPath}?${queryString}` : actionPath;
}

export function CompetitionFilters({ actionPath, filters, total }: CompetitionFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);

  useEffect(() => {
    setQuery(filters.query);
  }, [filters.query]);

  useEffect(() => {
    const normalizedQuery = query.trim().slice(0, 120);

    if (normalizedQuery === filters.query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace(
        buildFilterHref(actionPath, {
          ...filters,
          query: normalizedQuery,
        }),
        { scroll: false },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionPath, filters, query, router]);

  return (
    <form
      action={actionPath}
      method="get"
      className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Filters</p>
          <p className="mt-2 text-lg font-black text-[#0f1c2c]">{total} competitions</p>
        </div>
        <Button
          type="submit"
          className="h-11 rounded-xl bg-[#f49700] px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-[#e08900]"
        >
          Apply filters
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[2fr_repeat(3,minmax(0,1fr))]">
        <div className="grid gap-2">
          <Label
            htmlFor="competition-search"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
          >
            Search
          </Label>
          <Input
            id="competition-search"
            name="q"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search by name or description"
            className="h-11 rounded-xl border-slate-200 bg-white text-sm text-[#0f1c2c] shadow-none focus-visible:ring-[#f49700]"
          />
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="competition-type"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
          >
            Type
          </Label>
          <select
            id="competition-type"
            name="type"
            defaultValue={filters.type}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#0f1c2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]"
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="open">Open</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="competition-format"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
          >
            Format
          </Label>
          <select
            id="competition-format"
            name="format"
            defaultValue={filters.format}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#0f1c2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]"
          >
            <option value="all">All</option>
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="competition-status"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
          >
            Status
          </Label>
          <select
            id="competition-status"
            name="status"
            defaultValue={filters.status}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#0f1c2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]"
          >
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>
    </form>
  );
}
