import { ChevronLeft } from "lucide-react";
import { BankForm } from "@/components/problem-bank/bank-form";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function OrganizerProblemBankCreatePage() {
  await getWorkspaceContext({ requireRole: "organizer" });

  return (
    <div className="w-full flex flex-col items-center pb-12 px-4 font-['Poppins']">
      <div className="w-full max-w-[1024px] mt-12 flex flex-col">

        {/* Back Link */}
        <ProgressLink
          href="/organizer/problem-bank"
          className="flex items-center gap-2 text-slate-500 hover:text-[#10182b] font-medium text-[15px] transition-colors mb-6 w-full max-w-3xl mx-auto"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Problem Banks
        </ProgressLink>

        {/* Page Header */}
        <div className="mb-8 max-w-3xl mx-auto w-full">
          <h1 className="text-3xl md:text-[34px] font-black text-[#10182b] tracking-tight leading-tight mb-2">
            Create Problem Bank
          </h1>
          <p className="text-slate-600 text-[15px] font-medium">
            Start by giving your new problem bank a name and a brief description.
          </p>
        </div>

        {/* Content Panel wrapping BankForm */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm w-full max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#10182b]">Bank Details</h2>
            <p className="text-slate-500 text-[14px]">Basic Information</p>
          </div>
          <BankForm mode="create" successRedirectHref="/organizer/problem-bank" />
        </div>

      </div>
    </div>
  );
}
