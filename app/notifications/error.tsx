"use client";

import { ErrorState } from "@/components/ui/feedback-states";

export default function NotificationsError() {
  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <ErrorState
          title="Notifications unavailable"
          description="Refresh the page or try again later."
          className="rounded-[24px] shadow-none"
        />
      </div>
    </section>
  );
}
