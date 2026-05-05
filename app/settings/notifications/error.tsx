"use client";

import { ErrorState } from "@/components/ui/feedback-states";

export default function NotificationSettingsError() {
  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title="Notification preferences unavailable"
          description="Refresh the page or try again later."
          className="rounded-[24px] shadow-none"
        />
      </div>
    </section>
  );
}
