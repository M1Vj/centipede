import { LoadingState } from "@/components/ui/feedback-states";

export default function NotificationSettingsLoading() {
  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <LoadingState
          title="Loading notification preferences"
          description="Fetching saved delivery settings."
          className="rounded-[24px] shadow-none"
        />
      </div>
    </section>
  );
}
