import { LoadingState } from "@/components/ui/feedback-states";

export default function NotificationsLoading() {
  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <LoadingState
          title="Loading notifications"
          description="Fetching inbox updates."
          className="rounded-[24px] shadow-none"
        />
      </div>
    </section>
  );
}
