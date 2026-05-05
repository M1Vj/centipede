import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompetitionSearchFilters } from "@/lib/competition/discovery";

type CompetitionFiltersProps = {
  actionPath: string;
  filters: CompetitionSearchFilters;
  total: number;
};

export function CompetitionFilters({ actionPath, filters, total }: CompetitionFiltersProps) {
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
          className="h-11 rounded-xl bg-[#f49700] px-5 text-sm font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-[#f49700]/30 hover:bg-[#e08900]"
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
            defaultValue={filters.query}
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
