import { OrganizerStatusLookup } from "@/components/organizer/status-lookup";

export default function OrganizerStatusPage({
  searchParams,
}: {
  searchParams: { token?: string | string[] };
}) {
  const initialToken = Array.isArray(searchParams.token)
    ? searchParams.token[0] || ""
    : searchParams.token || "";

  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-4">
          <span className="eyebrow">Organizer Review Status</span>
          <h1 className="section-heading text-4xl">Check organizer application status</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Use the secure token from your submission confirmation to view pending,
            approved, or rejected status updates.
          </p>
        </div>
        <OrganizerStatusLookup initialToken={initialToken} />
      </div>
    </section>
  );
}
