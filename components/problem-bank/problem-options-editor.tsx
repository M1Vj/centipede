import { GripHorizontal, ImageIcon, ListChecks, Plus, Trash2 } from "lucide-react";
import { type ProblemType } from "@/lib/problem-bank/types";
import { MathliveField } from "@/components/math-editor/mathlive-field";

interface FormOption {
  id: string;
  label: string;
  _reactKey: number;
}

interface ProblemOptionsEditorProps {
  type: ProblemType;
  // MCQ props
  mcqOptions: FormOption[];
  correctOptionIds: string[];
  onAddMcqOption: () => void;
  onRemoveMcqOption: (id: string) => void;
  onUpdateMcqOption: (id: string, key: "id" | "label", value: string) => void;
  onToggleCorrectMcqOption: (id: string, checked: boolean) => void;

  // TF props
  tfOptions: FormOption[];
  tfAcceptedAnswer: "true" | "false";
  onUpdateTfOptionLabel: (id: string, label: string) => void;
  onUpdateTfAcceptedAnswer: (ans: "true" | "false") => void;

  // Numeric / ID props
  acceptedAnswerEntries: string[];
  onAddAcceptedAnswerEntry: () => void;
  onRemoveAcceptedAnswerEntry: (index: number) => void;
  onUpdateAcceptedAnswerEntry: (index: number, value: string) => void;
}

export function ProblemOptionsEditor({
  type,
  mcqOptions,
  correctOptionIds,
  onAddMcqOption,
  onRemoveMcqOption,
  onUpdateMcqOption,
  onToggleCorrectMcqOption,
  tfOptions,
  tfAcceptedAnswer,
  onUpdateTfOptionLabel,
  onUpdateTfAcceptedAnswer,
  acceptedAnswerEntries,
  onAddAcceptedAnswerEntry,
  onRemoveAcceptedAnswerEntry,
  onUpdateAcceptedAnswerEntry,
}: ProblemOptionsEditorProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full font-['Poppins',sans-serif]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#f49700]/10 flex items-center justify-center text-[#f49700]">
            <ListChecks className="w-5 h-5" />
          </div>
          <h2 className="text-[18px] font-bold text-[#10182b]">Answer Configuration</h2>
        </div>

        {(type === "mcq" || type === "identification" || type === "numeric") && (
          <button
            type="button"
            onClick={type === "mcq" ? onAddMcqOption : onAddAcceptedAnswerEntry}
            className="flex items-center gap-2 text-[#f49700] hover:text-[#e08900] font-black text-[13px] uppercase tracking-wide transition-colors"
          >
            <Plus className="w-4 h-4" /> ADD {type === "mcq" ? "OPTION" : "ANSWER"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {type === "mcq" && (
          <>
            {mcqOptions.map((opt) => {
              const isCorrect = correctOptionIds.includes(opt.id);
              return (
                <div
                  key={opt._reactKey}
                  className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all focus-within:border-[#f49700]/50 focus-within:ring-1 focus-within:ring-[#f49700]/50 group"
                >
                  <button
                    type="button"
                    onClick={() => onToggleCorrectMcqOption(opt.id, !isCorrect)}
                    className="cursor-pointer shrink-0 outline-none"
                    aria-label="Toggle correct answer"
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-[6px] ${
                        isCorrect ? "border-[#f49700] bg-white" : "border-slate-300 bg-white"
                      } transition-colors`}
                    ></div>
                  </button>
                  <div className="flex-1">
                    <MathliveField
                      id={`mcq-opt-${opt.id}`}
                      label=""
                      value={opt.label}
                      onChange={(val) => onUpdateMcqOption(opt.id, "label", val)}
                      placeholder="Enter option..."
                      className="bg-transparent border-none outline-none text-[#10182b] font-medium text-[15px] placeholder:text-slate-400 w-full"
                      showPreviewToggle={true}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 shrink-0">
                    <button type="button" className="hover:text-[#10182b] transition-colors p-1" title="Add Image">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-slate-200"></div>
                    <button type="button" className="hover:text-[#10182b] transition-colors p-1 cursor-grab" title="Drag to reorder">
                      <GripHorizontal className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveMcqOption(opt.id)}
                      className="hover:text-red-500 transition-colors p-1"
                      title="Delete Option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {type === "tf" && (
          <>
            {tfOptions.map((opt) => {
              const isCorrect = tfAcceptedAnswer === opt.id;
              return (
                <div
                  key={opt._reactKey}
                  className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all focus-within:border-[#f49700]/50 focus-within:ring-1 focus-within:ring-[#f49700]/50 group"
                >
                  <button
                    type="button"
                    onClick={() => onUpdateTfAcceptedAnswer(opt.id as "true" | "false")}
                    className="cursor-pointer shrink-0 outline-none"
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-[6px] ${
                        isCorrect ? "border-[#f49700] bg-white" : "border-slate-300 bg-white"
                      } transition-colors`}
                    ></div>
                  </button>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => onUpdateTfOptionLabel(opt.id, e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-[#10182b] font-medium text-[15px] placeholder:text-slate-400 w-full"
                    placeholder="True / False"
                  />
                </div>
              );
            })}
          </>
        )}

        {(type === "numeric" || type === "identification") && (
          <>
            {acceptedAnswerEntries.map((ans, index) => (
              <div
                key={index}
                className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all focus-within:border-[#f49700]/50 focus-within:ring-1 focus-within:ring-[#f49700]/50 group"
              >
                <div className="w-5 h-5 rounded-full border-[6px] border-[#f49700] bg-white transition-colors shrink-0"></div>
                <div className="flex-1">
                  <MathliveField
                    id={`accepted-answer-${index}`}
                    label=""
                    value={ans}
                    onChange={(val) => onUpdateAcceptedAnswerEntry(index, val)}
                    placeholder="Enter accepted answer..."
                    className="bg-transparent border-none outline-none text-[#10182b] font-medium text-[15px] placeholder:text-slate-400 w-full"
                    showPreviewToggle={true}
                  />
                </div>
                <div className="flex items-center gap-3 text-slate-400 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRemoveAcceptedAnswerEntry(index)}
                    className="hover:text-red-500 transition-colors p-1"
                    title="Delete Answer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
