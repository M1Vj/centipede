import {
  DetailSectionSkeleton,
  FormSkeleton,
} from "@/components/ui/feedback-skeletons";

export default function Loading() {
  return (
    <div className="w-full px-4 py-12">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 font-['Poppins']">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
            Loading competition settings...
          </p>
          <div className="h-3 w-56 rounded-full bg-slate-100" />
        </div>
        <DetailSectionSkeleton lines={4} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <FormSkeleton fields={4} />
          <DetailSectionSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}
