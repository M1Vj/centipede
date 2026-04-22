import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  Search,
  Filter,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Database,
  CheckCircle2,
  Trash2,
  X,
  GripVertical
} from "lucide-react";
import imgMathWizLogo from "figma:asset/80242dec49a0e15422af2e36b8832eecb94e9250.png";

type Problem = {
  id: string;
  tags: string[];
  content: string;
  answer: string;
};

type Bank = {
  id: string;
  name: string;
  problems: Problem[];
};

export default function OrganizerCreateCompetitionStep3() {
  const navigate = useNavigate();

  // Mock Data restructured for better UX
  const banksData: Bank[] = [
    { 
      id: "b1", 
      name: "Land Bank", 
      problems: [
        { id: "p1", tags: ["algebra", "easy"], content: "2x + 5 = 15", answer: "x = 5" },
        { id: "p2", tags: ["geometry", "medium"], content: "\\text{Area of a circle with } r=4", answer: "16\\pi" }
      ]
    },
    { 
      id: "b2", 
      name: "Math 101", 
      problems: [
        { id: "p3", tags: ["calculus", "hard"], content: "\\int_0^1 x^2 dx", answer: "1/3" },
        { id: "p6", tags: ["algebra", "easy"], content: "3x = 12", answer: "x = 4" },
        { id: "p7", tags: ["geometry", "medium"], content: "\\text{Area of a square with side } a=5", answer: "25" },
        { id: "p8", tags: ["trigonometry", "hard"], content: "\\sin(30^\\circ)", answer: "0.5" },
        { id: "p9", tags: ["algebra", "medium"], content: "x^2 - 4 = 0", answer: "x = \\pm 2" }
      ]
    },
    { 
      id: "b3", 
      name: "Central Bank", 
      problems: [
        { id: "p4", tags: ["Central Bank", "average", "mcq"], content: "\\text{SsASDADAD}\\theta x^2", answer: "ADASD" },
        { id: "p5", tags: ["Central Bank", "average", "mcq"], content: "$ \\text{wqeqweqwe} $", answer: "qweqweqwe" }
      ]
    },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // Ordered array instead of Set
  const [expandedBanks, setExpandedBanks] = useState<Record<string, boolean>>({
    "b3": true // Default expand Central Bank based on previous context
  });

  const toggleBank = (bankId: string) => {
    setExpandedBanks(prev => ({ ...prev, [bankId]: !prev[bankId] }));
  };

  const handleAdd = (id: string) => {
    if (!selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleRemove = (id: string) => {
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const handleSelectAllBank = (bank: Bank) => {
    const newSelected = [...selectedIds];
    bank.problems.forEach(p => {
      if (!newSelected.includes(p.id)) newSelected.push(p.id);
    });
    setSelectedIds(newSelected);
  };

  const handleRemoveAllBank = (bank: Bank) => {
    const bankProblemIds = new Set(bank.problems.map(p => p.id));
    setSelectedIds(prev => prev.filter(id => !bankProblemIds.has(id)));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  // Compute total available problems for simple stats
  const totalAvailable = banksData.reduce((acc, bank) => acc + bank.problems.length, 0);

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col items-center pt-4 pb-24 px-4 font-['Poppins']">
      
      {/* Floating Pill Navbar */}
      <nav className="backdrop-blur-md bg-[#10182b] w-full max-w-[1024px] rounded-full px-5 py-3 flex items-center justify-between shadow-2xl border border-white/5 relative z-50">
        <Link to="/" className="flex items-center gap-2 pl-3">
          <img src={imgMathWizLogo} alt="MathWiz" className="h-7 w-auto object-contain" />
          <span className="text-[#f49700] font-bold text-[14px] tracking-wide">
            Organizer
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
          <Link to="/organizer-dashboard" className="text-white font-semibold text-[15px] hover:text-[#f49700] transition-colors">Dashboard</Link>
          <Link to="/organizer-competitions" className="text-[#f49700] font-semibold text-[15px] hover:opacity-80 transition-colors">Competitions</Link>
          <Link to="/organizer-problembank" className="text-white font-semibold text-[15px] hover:text-[#f49700] transition-colors">Problembanks</Link>
          <a href="#" className="text-white font-semibold text-[15px] hover:text-[#f49700] transition-colors">History</a>
        </div>

        <div className="flex items-center gap-4 pr-2">
          <button className="text-[#f49700] hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>
          <div className="px-4 py-1.5 rounded-full bg-[#f49700] shadow-md cursor-pointer hover:bg-[#e08900] transition-colors flex items-center justify-center text-[#10182b] font-bold text-[13px]">
            Organizer
          </div>
        </div>
      </nav>

      <div className="w-full max-w-[1100px] mt-12 flex flex-col gap-6">
        
        {/* Progress Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[#f49700] text-[13px] font-black uppercase tracking-wider mb-2">Step 3 of 5</div>
              <h1 className="text-[28px] md:text-[32px] font-black text-[#10182b] leading-tight">
                Competition Problems
              </h1>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-black text-[#10182b] leading-none mb-1">60%</div>
              <div className="text-slate-400 text-[12px] font-bold uppercase tracking-wider">Completed</div>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6">
            <div className="bg-[#f49700] h-full rounded-full transition-all duration-500" style={{ width: '60%' }}></div>
          </div>
          
          <p className="text-slate-500 font-medium text-[15px]">
            Select, search, and order problems before publish.
          </p>
        </div>

        {/* Dual Pane Selector Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col md:flex-row h-[750px]">
          
          {/* Left Pane - Available Problems */}
          <div className="flex-1 md:w-[55%] flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white">
            
            {/* Left Header & Search */}
            <div className="p-6 pb-4 border-b border-slate-100 flex flex-col gap-4">
              <h2 className="text-[#10182b] font-bold text-[18px]">Available problems</h2>
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search problems, tags, or difficulty..."
                    className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-10 pr-4 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="relative w-[160px] hidden sm:block">
                  <select className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-4 pr-10 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all">
                    <option>All banks</option>
                    {banksData.map(b => <option key={b.id}>{b.name}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Filter className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between mt-1 gap-3">
                <div className="text-slate-500 text-[12px] font-bold">
                  {totalAvailable} visible after search and bank filter.
                </div>
                <div className="flex items-center gap-4">
                  <button className="text-[#f49700] hover:text-[#e08900] text-[12px] font-bold flex items-center gap-1 transition-colors">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Select all visible
                  </button>
                  <button className="text-slate-400 hover:text-slate-600 text-[12px] font-bold flex items-center gap-1 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Remove all visible
                  </button>
                </div>
              </div>
            </div>

            {/* Accordion List of Banks / Problems */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50/50 custom-scrollbar">
              
              {banksData.map(bank => {
                const selectedInBank = bank.problems.filter(p => selectedIds.includes(p.id)).length;
                const isExpanded = expandedBanks[bank.id];
                const allSelected = bank.problems.length > 0 && selectedInBank === bank.problems.length;

                return (
                  <div key={bank.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
                    {/* Bank Header (Clickable) */}
                    <div 
                      onClick={() => toggleBank(bank.id)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${selectedInBank > 0 ? 'bg-[#f49700]/10 text-[#f49700]' : 'bg-blue-50 text-blue-500'}`}>
                          <Database className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#10182b] font-bold text-[15px] flex items-center gap-2">
                            {bank.name}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </span>
                          <span className="text-slate-400 text-[12px] font-medium">{selectedInBank} of {bank.problems.length} problems selected</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleSelectAllBank(bank)}
                          disabled={allSelected}
                          className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-1.5 border ${
                            allSelected 
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
                              : 'bg-slate-50 hover:bg-[#f49700]/10 border-slate-200 hover:border-[#f49700]/30 text-[#10182b] hover:text-[#f49700]'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Select all
                        </button>
                        <button 
                          onClick={() => handleRemoveAllBank(bank)}
                          disabled={selectedInBank === 0}
                          className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-1.5 border ${
                            selectedInBank === 0
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-slate-50 hover:bg-red-50 border-slate-200 hover:border-red-200 text-[#10182b] hover:text-red-500'
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5" /> Remove all
                        </button>
                      </div>
                    </div>

                    {/* Problems List (Expanded State) */}
                    {isExpanded && (
                      <div className="flex flex-col gap-3 p-4 pr-3 bg-slate-50/50 max-h-[360px] overflow-y-auto custom-scrollbar border-t border-slate-100">
                        {bank.problems.map(prob => {
                          const isSelected = selectedIds.includes(prob.id);
                          return (
                            <div key={prob.id} className={`shrink-0 bg-white border rounded-xl p-4 flex flex-col gap-3 shadow-sm transition-all ${isSelected ? 'border-[#f49700] ring-1 ring-[#f49700]/20' : 'border-slate-200 hover:border-slate-300'}`}>
                              <div className="flex flex-wrap items-center gap-2">
                                {prob.tags.map((tag, idx) => (
                                  <div key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    {tag}
                                  </div>
                                ))}
                              </div>
                              
                              <div className="flex flex-col gap-1.5">
                                <div className="text-[#10182b] font-medium text-[14px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                  {prob.content}
                                </div>
                                <div className="text-slate-500 text-[12px] font-medium pl-1">
                                  Ans: {prob.answer}
                                </div>
                              </div>
                              
                              <div className="flex justify-end mt-1">
                                {!isSelected ? (
                                  <button 
                                    onClick={() => handleAdd(prob.id)}
                                    className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-4 py-1.5 rounded-lg font-bold text-[12px] transition-colors flex items-center gap-1.5 shadow-sm"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add Problem
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleRemove(prob.id)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-1.5 rounded-lg font-bold text-[12px] transition-colors flex items-center gap-1.5 border border-slate-200"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Added
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* Invisible spacer to guarantee bottom padding is respected by the browser's scroll container */}
                        <div className="h-1 shrink-0"></div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>

          {/* Right Pane - Selected Problems */}
          <div className="flex-1 md:w-[45%] flex flex-col bg-[#fafafb]">
            
            {/* Right Header */}
            <div className="p-6 pb-4 border-b border-slate-200 flex flex-col gap-1.5 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-[#10182b] font-bold text-[18px]">Selected problems</h2>
                {selectedIds.length > 0 && (
                  <button onClick={handleClearAll} className="text-slate-400 hover:text-red-500 text-[12px] font-bold flex items-center gap-1 transition-colors">
                    Clear all
                  </button>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <span className={`font-black text-[15px] ${selectedIds.length >= 10 ? 'text-green-500' : 'text-[#f49700]'}`}>
                  {selectedIds.length} selected
                </span>
                <span className="text-slate-400 text-[12px] font-medium">Publish requires 10 to 100.</span>
              </div>
              
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                  className={`${selectedIds.length >= 10 ? 'bg-green-500' : 'bg-[#f49700]'} h-full rounded-full transition-all duration-300`} 
                  style={{ width: `${Math.min(100, (selectedIds.length / 10) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Selected Items List / Empty State */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3 custom-scrollbar bg-slate-50/50">
              
              {selectedIds.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 border-2 border-dashed border-slate-200 rounded-2xl bg-white min-h-[300px]">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-4 text-slate-300">
                    <Database className="w-8 h-8" />
                  </div>
                  <h3 className="text-[#10182b] font-bold text-[16px] mb-2">No problems selected</h3>
                  <p className="text-slate-500 text-[13px] font-medium max-w-[250px]">
                    Pick problems from the left pane to build your competition snapshots. You can reorder them here later.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedIds.map((id, index) => {
                    // Find problem data across all banks
                    let prob: Problem | undefined;
                    for (const bank of banksData) {
                      const found = bank.problems.find(p => p.id === id);
                      if (found) {
                        prob = found;
                        break;
                      }
                    }
                    if (!prob) return null;

                    return (
                      <div key={id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex items-center gap-3 hover:border-slate-300 transition-all group">
                        
                        {/* Drag Handle & Index */}
                        <div className="flex flex-col items-center gap-1 cursor-grab text-slate-300 hover:text-[#f49700] transition-colors">
                          <GripVertical className="w-4 h-4" />
                          <span className="text-[10px] font-bold">{index + 1}</span>
                        </div>

                        {/* Problem Mini Info */}
                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {prob.tags.slice(0, 2).map((tag, idx) => (
                              <span key={idx} className="text-slate-500 text-[9px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                {tag}
                              </span>
                            ))}
                            {prob.tags.length > 2 && (
                              <span className="text-slate-400 text-[9px] font-bold uppercase bg-slate-50 px-1 rounded">+{prob.tags.length - 2}</span>
                            )}
                          </div>
                          <div className="text-[#10182b] font-medium text-[13px] font-mono truncate w-full">
                            {prob.content}
                          </div>
                        </div>

                        {/* Remove Action */}
                        <button 
                          onClick={() => handleRemove(id)}
                          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Footer */}
            <div className="p-5 border-t border-slate-200 bg-white">
              <div className={`flex items-start gap-3 rounded-xl p-4 border transition-colors ${
                selectedIds.length >= 10 
                  ? 'bg-green-50/50 text-green-700 border-green-100' 
                  : 'bg-blue-50/50 text-blue-700 border-blue-100'
              }`}>
                <div className="font-bold text-[12px] leading-relaxed">
                  {selectedIds.length >= 10 ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Ready to publish! You have selected at least 10 problems.
                    </span>
                  ) : (
                    <span>
                      Publish requires between <strong>10</strong> and <strong>100</strong> selected problems. 
                      You need <strong>{Math.max(0, 10 - selectedIds.length)}</strong> more.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-4 flex items-center justify-between w-full mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-6 py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          <button 
            onClick={() => navigate('/organizer-competitions/create/step4')}
            className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-8 py-3.5 rounded-xl font-bold text-[15px] transition-all shadow-sm hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2"
          >
            Continue to Scoring <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}