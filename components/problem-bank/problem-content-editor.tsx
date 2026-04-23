import { Pencil } from "lucide-react";
import { MathliveField } from "@/components/math-editor/mathlive-field";

interface ProblemContentEditorProps {
  contentLatex: string;
  explanationLatex: string;
  onContentChange: (val: string) => void;
  onExplanationChange: (val: string) => void;
}

export function ProblemContentEditor({
  contentLatex,
  explanationLatex,
  onContentChange,
  onExplanationChange,
}: ProblemContentEditorProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full font-['Poppins',sans-serif]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-[#f49700]/10 flex items-center justify-center text-[#f49700]">
          <Pencil className="w-5 h-5" />
        </div>
        <h2 className="text-[18px] font-bold text-[#10182b]">Question Content</h2>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        <label className="text-[#10182b] font-bold text-[13px]">Problem Content</label>
        {/* We use MathliveField but style its container specifically */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#f49700] transition-all">
          <div className="p-4 min-h-[120px] relative">
            <MathliveField
              id="problem-content"
              label=""
              value={contentLatex}
              onChange={onContentChange}
              placeholder="Enter problem statement.."
              className="w-full bg-transparent border-none outline-none text-[15px] text-[#10182b] placeholder:text-slate-400 font-medium resize-none h-full"
              showPreviewToggle={true}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[#10182b] font-bold text-[13px]">Explanation</label>
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#f49700] transition-all">
          <div className="p-4 min-h-[100px] relative">
            <MathliveField
              id="problem-explanation"
              label=""
              value={explanationLatex}
              onChange={onExplanationChange}
              placeholder="Explain the solution step-by-step..."
              className="w-full bg-transparent border-none outline-none text-[15px] text-[#10182b] placeholder:text-slate-400 font-medium resize-none h-full"
              showPreviewToggle={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
