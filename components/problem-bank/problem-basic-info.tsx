import { ChevronRight, Info, X } from "lucide-react";
import { type ProblemDifficulty, type ProblemType } from "@/lib/problem-bank/types";

interface ProblemBasicInfoProps {
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tagsInput: string;
  onTypeChange: (nextType: ProblemType) => void;
  onDifficultyChange: (nextDifficulty: ProblemDifficulty) => void;
  onTagsChange: (nextTags: string) => void;
}

export function ProblemBasicInfo({
  type,
  difficulty,
  tagsInput,
  onTypeChange,
  onDifficultyChange,
  onTagsChange,
}: ProblemBasicInfoProps) {
  // Convert tags input (joined by " | ") into an array for the pill UI
  const tagsList = tagsInput
    .split("|")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();
      if (newTag && !tagsList.includes(newTag)) {
        const updatedList = [...tagsList, newTag];
        onTagsChange(updatedList.join(" | "));
      }
      e.currentTarget.value = "";
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedList = tagsList.filter((t) => t !== tagToRemove);
    onTagsChange(updatedList.join(" | "));
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full font-['Poppins',sans-serif]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-[#f49700]/10 flex items-center justify-center text-[#f49700]">
          <Info className="w-5 h-5" />
        </div>
        <h2 className="text-[18px] font-bold text-[#10182b]">Basic Information</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="problem-type" className="text-[#10182b] font-bold text-[13px]">Problem Type</label>
          <div className="relative">
            <select
              id="problem-type"
              value={type}
              onChange={(e) => onTypeChange(e.target.value as ProblemType)}
              className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] appearance-none"
            >
              <option value="mcq">Multiple Choice Question (MCQ)</option>
              <option value="tf">True / False</option>
              <option value="numeric">Numeric Answer</option>
              <option value="identification">Identification</option>
            </select>
            <ChevronRight className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="problem-difficulty" className="text-[#10182b] font-bold text-[13px]">Difficulty Level</label>
          <div className="relative">
            <select
              id="problem-difficulty"
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value as ProblemDifficulty)}
              className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] appearance-none"
            >
              <option value="easy">Level 2 - Easy</option>
              <option value="average">Level 3 - Intermediate</option>
              <option value="difficult">Level 4 - Advanced</option>
            </select>
            <ChevronRight className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="problem-tags" className="text-[#10182b] font-bold text-[13px]">Tags (Press Enter to add)</label>
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 min-h-[52px] flex flex-wrap items-center gap-2 focus-within:ring-2 focus-within:ring-[#f49700] transition-all">
          {tagsList.map((tag) => (
            <div
              key={tag}
              className="flex items-center gap-1.5 bg-[#10182b] text-white px-3 py-1.5 rounded-xl text-[13px] font-bold"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-red-400 transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <input
            id="problem-tags"
            type="text"
            placeholder="Type tag and press enter..."
            onKeyDown={handleAddTag}
            className="bg-transparent border-none outline-none text-[14px] text-[#10182b] placeholder:text-slate-400 font-medium flex-1 min-w-[200px]"
          />
        </div>
      </div>
    </div>
  );
}
