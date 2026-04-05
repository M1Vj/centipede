import { OrganizerApplicationForm } from "@/components/organizer/application-form";

export default function OrganizerApplyPage() {
  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <span className="eyebrow">Organizer Eligibility</span>
          <h1 className="section-heading text-4xl">Apply to become a verified organizer</h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Submit your organization details, legal consent, and optional logo for review.
            You do not need an existing organizer account to start this process.
          </p>
        </div>
        <OrganizerApplicationForm />
      </div>
    </section>
  );
}
