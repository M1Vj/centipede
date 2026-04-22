import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  ArrowLeft,
  ArrowRight,
  Zap,
  Edit3,
  Info,
  Plus,
  Trash2,
  AlertCircle,
  X
} from "lucide-react";
import imgMathWizLogo from "figma:asset/80242dec49a0e15422af2e36b8832eecb94e9250.png";

type OffenseRule = {
  id: number;
  threshold: string;
  penaltyKind: string;
  value: string;
};

export default function OrganizerCreateCompetitionStep4() {
  const navigate = useNavigate();

  // State
  const [scoringMode, setScoringMode] = useState<"auto" | "manual">("auto");
  const [easyPoints, setEasyPoints] = useState("1");
  const [averagePoints, setAveragePoints] = useState("2");
  const [difficultPoints, setDifficultPoints] = useState("3");

  const [tieBreaker, setTieBreaker] = useState("Earliest final submission");
  const [wrongAnswerPenalty, setWrongAnswerPenalty] = useState("Fixed deduction");
  const [deductionValue, setDeductionValue] = useState("0");
  
  const [attemptPolicy, setAttemptPolicy] = useState("Highest score");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [logTabSwitch, setLogTabSwitch] = useState(false);

  const [offenseRules, setOffenseRules] = useState<OffenseRule[]>([
    { id: 1, threshold: "1", penaltyKind: "Deduction", value: "1" }
  ]);

  const [isManualPointsModalOpen, setIsManualPointsModalOpen] = useState(false);
  const [manualPointsData, setManualPointsData] = useState([
    { id: 1, title: "Calculate the integral of e^x", difficulty: "Average", type: "Multiple Choice", points: 2 },
    { id: 2, title: "Solve for x in 2x + 5 = 15", difficulty: "Easy", type: "Short Answer", points: 1 },
    { id: 3, title: "Find the eigenvectors of the given matrix", difficulty: "Difficult", type: "Multiple Choice", points: 3 },
  ]);

  // Validation
  const isDeductionInvalid = wrongAnswerPenalty === "Fixed deduction" && (parseFloat(deductionValue) <= 0 || deductionValue === "");

  const handleAddRule = () => {
    const nextId = offenseRules.length > 0 ? Math.max(...offenseRules.map(r => r.id)) + 1 : 1;
    setOffenseRules([...offenseRules, { id: nextId, threshold: "", penaltyKind: "Deduction", value: "" }]);
  };

  const handleRemoveRule = (id: number) => {
    setOffenseRules(offenseRules.filter(r => r.id !== id));
  };

  const handleRuleChange = (id: number, field: keyof OffenseRule, newValue: string) => {
    setOffenseRules(offenseRules.map(r => r.id === id ? { ...r, [field]: newValue } : r));
  };

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
          <div className="px-5 py-2 rounded-full bg-[#f49700] shadow-md cursor-pointer hover:bg-[#e08900] transition-colors flex items-center justify-center text-white font-bold text-[14px]">
            Organizer
          </div>
        </div>
      </nav>

      <div className="w-full max-w-[1100px] mt-12 flex flex-col gap-6">
        
        {/* Progress Card */}
        <div className="bg-white rounded-[16px] border border-[#e7cfa6] p-[33px] shadow-sm w-full">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-1">
              <div className="text-[#f49700] text-[14px] font-bold uppercase tracking-[0.7px]">Step 4 of 5</div>
              <h1 className="text-[30px] font-bold text-[#1e293b] leading-tight">
                Competition Scoring
              </h1>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="text-[24px] font-bold text-[#1e293b] leading-none mb-1">80%</div>
              <div className="text-slate-500 text-[14px]">Completed</div>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6 relative">
            <div className="bg-[#f49700] h-full rounded-full transition-all duration-500 shadow-[0px_0px_10px_0px_rgba(245,159,10,0.4)]" style={{ width: '80%' }}></div>
          </div>
          
          <p className="text-[#475569] text-[16px]">
            Define the availability and timeframe for your mathematics competition.
          </p>
        </div>

        {/* Dual Pane Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Pane - Main Settings Form */}
          <div className="flex-1 w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Scoring Mode Section */}
            <div className="p-8 border-b border-slate-100 flex flex-col gap-6">
              <div>
                <h2 className="text-[#10182b] font-black text-[18px] mb-1">Scoring mode</h2>
                <p className="text-slate-500 text-[13px] font-medium">Select how points will be distributed among problems.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto-Level Points Card */}
                <div 
                  onClick={() => setScoringMode("auto")}
                  className={`cursor-pointer rounded-[12px] p-[20px] border-2 transition-all relative ${
                    scoringMode === "auto" 
                      ? 'border-[#f59f0a] bg-[rgba(245,159,10,0.05)] shadow-sm' 
                      : 'border-[#c1c4c7] hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-[40px] h-[40px] rounded-[8px] flex items-center justify-center ${scoringMode === "auto" ? 'bg-[rgba(245,159,10,0.2)] text-[#f59f0a]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center ${scoringMode === "auto" ? 'border-[#f49700]' : 'border-[#cbd5e1]'}`}>
                      {scoringMode === "auto" && <div className="w-2.5 h-2.5 rounded-full bg-[#f49700]"></div>}
                    </div>
                  </div>
                  <h3 className="text-[#0f172a] font-semibold text-[16px] mb-1.5 leading-snug">Auto-Level Points</h3>
                  <p className="text-[#64748b] text-[13px] leading-[20px]">
                    Set points once for each difficulty level. Points are automatically assigned based on problem difficulty.
                  </p>
                </div>

                {/* Manual Points Card */}
                <div 
                  onClick={() => setScoringMode("manual")}
                  className={`cursor-pointer rounded-[12px] p-[20px] border-2 transition-all relative ${
                    scoringMode === "manual" 
                      ? 'border-[#f59f0a] bg-[rgba(245,159,10,0.05)] shadow-sm' 
                      : 'border-[#c1c4c7] hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-[40px] h-[40px] rounded-[8px] flex items-center justify-center ${scoringMode === "manual" ? 'bg-[rgba(245,159,10,0.2)] text-[#f59f0a]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center ${scoringMode === "manual" ? 'border-[#f49700]' : 'border-[#cbd5e1]'}`}>
                      {scoringMode === "manual" && <div className="w-2.5 h-2.5 rounded-full bg-[#f49700]"></div>}
                    </div>
                  </div>
                  <h3 className="text-[#0f172a] font-semibold text-[16px] mb-1.5 leading-snug">Manual Points</h3>
                  <p className="text-[#64748b] text-[13px] leading-[20px]">
                    Set custom points for each individual problem. More control, more flexibility for unique scoring systems.
                  </p>
                </div>
              </div>

              {scoringMode === "auto" && (
                <div className="flex flex-col gap-6 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="bg-[#f3f8ff] rounded-[8px] p-[16px] flex items-start gap-4 shadow-sm border border-[#e2e8f0]/50">
                    <Info className="w-5 h-5 text-[#475569] shrink-0 mt-0.5" />
                    <p className="text-[#334155] text-[14px] leading-[22.75px] font-medium">
                      With Auto-Level Points, all Easy problems will receive the same points, all Average problems will receive the same points, and so on.
                    </p>
                  </div>

                  <div className="bg-white rounded-[12px] border border-[#f1f5f9] p-[33px] shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="flex flex-col gap-3">
                        <label className="text-[#475569] text-[14px] font-medium">Easy Points</label>
                        <input 
                          type="number" 
                          value={easyPoints}
                          onChange={e => setEasyPoints(e.target.value)}
                          className="w-full bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] rounded-[8px] px-4 py-3.5 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f59f0a]/50 focus:border-[#f59f0a] transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="text-[#475569] text-[14px] font-medium">Average Points</label>
                        <input 
                          type="number" 
                          value={averagePoints}
                          onChange={e => setAveragePoints(e.target.value)}
                          className="w-full bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] rounded-[8px] px-4 py-3.5 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f59f0a]/50 focus:border-[#f59f0a] transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="text-[#475569] text-[14px] font-medium">Difficult Points</label>
                        <input 
                          type="number" 
                          value={difficultPoints}
                          onChange={e => setDifficultPoints(e.target.value)}
                          className="w-full bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] rounded-[8px] px-4 py-3.5 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f59f0a]/50 focus:border-[#f59f0a] transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {scoringMode === "manual" && (
                <div className="flex flex-col gap-6 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="bg-[#fdf8f6] rounded-[8px] p-[16px] flex items-start gap-4 shadow-sm border border-[#f49700]/20">
                    <Info className="w-5 h-5 text-[#f49700] shrink-0 mt-0.5" />
                    <p className="text-[#334155] text-[14px] leading-[22.75px] font-medium">
                      With Manual Points, you assign points individually for each problem selected for this competition.
                    </p>
                  </div>

                  <div className="flex justify-center md:justify-start">
                    <button 
                      onClick={() => setIsManualPointsModalOpen(true)}
                      className="bg-[#f49700] hover:bg-[#e08900] text-white font-bold text-[14px] rounded-[9999px] py-3.5 px-8 transition-colors shadow-md flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Set Manual Points
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rules & Penalties Section */}
            <div className="p-8 border-b border-slate-100 flex flex-col gap-6">
              <div>
                <h2 className="text-[#10182b] font-black text-[18px] mb-1">Scoring rules</h2>
                <p className="text-slate-500 text-[13px] font-medium">Set tie-breakers and wrong-answer deductions.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2 relative">
                  <label className="text-[#10182b] text-[14px] font-bold">Tie-breaker</label>
                  <select 
                    value={tieBreaker}
                    onChange={e => setTieBreaker(e.target.value)}
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-4 pr-10 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                  >
                    <option>Earliest final submission (default)</option>
                    <option>Highest accuracy percentage</option>
                    <option>None (Allow ties)</option>
                  </select>
                  <div className="absolute right-4 top-[38px] pointer-events-none text-slate-400">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.41 0.589966L6 5.16997L10.59 0.589966L12 1.99997L6 7.99997L0 1.99997L1.41 0.589966Z" fill="currentColor"/></svg>
                  </div>
                </div>

                <div className="flex flex-col gap-2 relative">
                  <label className="text-[#10182b] text-[14px] font-bold">Wrong-answer penalty</label>
                  <select 
                    value={wrongAnswerPenalty}
                    onChange={e => setWrongAnswerPenalty(e.target.value)}
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-4 pr-10 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                  >
                    <option>Fixed deduction</option>
                    <option>No penalty</option>
                    <option>Percentage deduction</option>
                  </select>
                  <div className="absolute right-4 top-[38px] pointer-events-none text-slate-400">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.41 0.589966L6 5.16997L10.59 0.589966L12 1.99997L6 7.99997L0 1.99997L1.41 0.589966Z" fill="currentColor"/></svg>
                  </div>
                </div>
              </div>

              {wrongAnswerPenalty === "Fixed deduction" && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                  <label className="text-[#10182b] text-[14px] font-bold flex items-center gap-2">
                    Deduction value
                    {isDeductionInvalid && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </label>
                  <input 
                    type="number" 
                    value={deductionValue}
                    onChange={e => setDeductionValue(e.target.value)}
                    className={`w-full md:w-1/2 bg-slate-50 border text-[#10182b] rounded-xl px-4 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-2 transition-all ${
                      isDeductionInvalid 
                        ? 'border-red-300 focus:ring-red-400 bg-red-50/30' 
                        : 'border-slate-200 focus:ring-[#f49700]'
                    }`}
                  />
                  {isDeductionInvalid && (
                    <p className="text-red-500 text-[12px] font-bold mt-1">
                      Deduction value must be greater than zero when penalty mode is fixed_deduction.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Anti-Cheat & Policies Section */}
            <div className="p-8 flex flex-col gap-6">
              <div>
                <h2 className="text-[#10182b] font-black text-[18px] mb-1">Attempt & Anti-cheat policy</h2>
                <p className="text-slate-500 text-[13px] font-medium">Configure behaviors to ensure academic integrity.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                <div className="flex flex-col gap-2 relative">
                  <label className="text-[#10182b] text-[14px] font-bold">Open competition attempt policy</label>
                  <select 
                    value={attemptPolicy}
                    onChange={e => setAttemptPolicy(e.target.value)}
                    className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl pl-4 pr-10 py-3.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
                  >
                    <option>Highest score</option>
                    <option>Latest score</option>
                    <option>Average score</option>
                  </select>
                  <div className="absolute right-4 top-[38px] pointer-events-none text-slate-400">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.41 0.589966L6 5.16997L10.59 0.589966L12 1.99997L6 7.99997L0 1.99997L1.41 0.589966Z" fill="currentColor"/></svg>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#10182b] font-bold text-[14px] group-hover:text-[#f49700] transition-colors">Shuffle questions</span>
                    <span className="text-slate-500 text-[12px] font-medium">Randomize the order of problems for each student.</span>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shuffleQuestions ? 'bg-[#f49700]' : 'bg-slate-200'}`}>
                    <input type="checkbox" className="sr-only" checked={shuffleQuestions} onChange={() => setShuffleQuestions(!shuffleQuestions)} />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${shuffleQuestions ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </label>

                <div className="h-px bg-slate-100 w-full"></div>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#10182b] font-bold text-[14px] group-hover:text-[#f49700] transition-colors">Shuffle options</span>
                    <span className="text-slate-500 text-[12px] font-medium">Randomize multiple-choice option order.</span>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shuffleOptions ? 'bg-[#f49700]' : 'bg-slate-200'}`}>
                    <input type="checkbox" className="sr-only" checked={shuffleOptions} onChange={() => setShuffleOptions(!shuffleOptions)} />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${shuffleOptions ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </label>

                <div className="h-px bg-slate-100 w-full"></div>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#10182b] font-bold text-[14px] group-hover:text-[#f49700] transition-colors">Log tab switch offenses</span>
                    <span className="text-slate-500 text-[12px] font-medium">Detect and penalize students for leaving the competition tab.</span>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${logTabSwitch ? 'bg-[#f49700]' : 'bg-slate-200'}`}>
                    <input type="checkbox" className="sr-only" checked={logTabSwitch} onChange={() => setLogTabSwitch(!logTabSwitch)} />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${logTabSwitch ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>

              {/* Tab Switch Penalty Rules */}
              {logTabSwitch && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-2 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-[#10182b] font-bold text-[15px]">Offense penalties</h3>
                      <p className="text-slate-500 text-[12px] font-medium">Applied when tab-switch logging is enabled and thresholds are reached.</p>
                    </div>
                    <button 
                      onClick={handleAddRule}
                      className="bg-white border border-slate-200 hover:border-[#f49700] hover:text-[#f49700] text-[#10182b] px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add rule
                    </button>
                  </div>

                  {offenseRules.length === 0 ? (
                    <div className="text-center py-6 bg-white border border-slate-200 rounded-xl">
                      <p className="text-slate-400 text-[13px] font-bold">No penalty rules defined.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {offenseRules.map((rule) => (
                        <div key={rule.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">Threshold</label>
                              <input 
                                type="number" 
                                value={rule.threshold}
                                onChange={e => handleRuleChange(rule.id, "threshold", e.target.value)}
                                placeholder="e.g. 1"
                                className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-lg px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700]"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">Penalty kind</label>
                              <select 
                                value={rule.penaltyKind}
                                onChange={e => handleRuleChange(rule.id, "penaltyKind", e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-lg px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700]"
                              >
                                <option>Deduction</option>
                                <option>Disqualification</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">Deduction value</label>
                              <input 
                                type="number" 
                                value={rule.value}
                                disabled={rule.penaltyKind === "Disqualification"}
                                onChange={e => handleRuleChange(rule.id, "value", e.target.value)}
                                placeholder="e.g. 1"
                                className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-lg px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] disabled:opacity-50 disabled:bg-slate-100"
                              />
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveRule(rule.id)}
                            className="bg-white border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 text-slate-400 p-2.5 rounded-lg transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right Pane - Sticky Scoring Summary */}
          <div className="w-full lg:w-[350px] shrink-0 sticky top-6 flex flex-col gap-4">
            <div className="bg-[#10182b] rounded-3xl p-6 shadow-xl relative overflow-hidden">
              {/* Decorative Background Elements */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#f49700]/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <h2 className="text-white font-black text-[18px] mb-2 flex items-center gap-2">
                <Info className="w-5 h-5 text-[#f49700]" /> Scoring summary
              </h2>
              <p className="text-slate-400 text-[12px] font-medium mb-6 leading-relaxed">
                Review scoring before publish. Snapshot values become immutable after publish.
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Scoring mode</span>
                  <span className="text-white text-[13px] font-medium">
                    {scoringMode === "auto" 
                      ? `Difficulty-based (easy=${easyPoints || 0}, average=${averagePoints || 0}, difficult=${difficultPoints || 0})` 
                      : "Manual"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Penalty</span>
                  <span className="text-white text-[13px] font-medium">
                    {wrongAnswerPenalty === "Fixed deduction" 
                      ? `Fixed deduction of ${deductionValue || 0} point(s) per wrong answer` 
                      : wrongAnswerPenalty}
                  </span>
                </div>

                <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Tie-breaker</span>
                  <span className="text-white text-[13px] font-medium">{tieBreaker}</span>
                </div>

                <div className="flex flex-col gap-1 border-b border-white/10 pb-4">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Attempt policy</span>
                  <span className="text-white text-[13px] font-medium">{attemptPolicy}</span>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[12px] font-bold">Question shuffle</span>
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${shuffleQuestions ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-300'}`}>
                      {shuffleQuestions ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[12px] font-bold">Option shuffle</span>
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${shuffleOptions ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-300'}`}>
                      {shuffleOptions ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[12px] font-bold">Tab-switch logging</span>
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${logTabSwitch ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-slate-300'}`}>
                      {logTabSwitch ? `${offenseRules.length} rules` : 'Disabled'}
                    </span>
                  </div>
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
            onClick={() => navigate('/organizer-competitions/create/step5')}
            className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-8 py-3.5 rounded-xl font-bold text-[15px] transition-all shadow-sm hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2"
          >
            Continue to Review <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Set Manual Points Modal */}
      {isManualPointsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-[#10182b] font-black text-[22px]">Set Manual Points</h2>
                <p className="text-slate-500 text-[14px] font-medium mt-1">Assign custom points to individual problems.</p>
              </div>
              <button onClick={() => setIsManualPointsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 bg-slate-50 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="overflow-y-auto p-6 flex-1 flex flex-col gap-4 bg-slate-50/50">
              {manualPointsData.map(problem => (
                <div key={problem.id} className="bg-white border border-slate-200 rounded-[16px] p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <h3 className="text-[#10182b] font-bold text-[15px] leading-tight">{problem.title}</h3>
                    <div className="flex items-center gap-3">
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${
                        problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                        problem.difficulty === 'Average' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {problem.difficulty}
                      </span>
                      <span className="text-slate-500 text-[12px] font-medium">{problem.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="text-slate-500 text-[13px] font-bold">Points:</label>
                    <input 
                      type="number"
                      value={problem.points}
                      onChange={(e) => {
                        const newPoints = parseInt(e.target.value) || 0;
                        setManualPointsData(prev => prev.map(p => p.id === problem.id ? {...p, points: newPoints} : p));
                      }}
                      className="w-[80px] bg-slate-50 border border-slate-200 text-[#10182b] rounded-xl px-3 py-2 text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-[#f49700] text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setIsManualPointsModalOpen(false)}
                className="px-6 py-2.5 rounded-[9999px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-[14px]"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsManualPointsModalOpen(false)}
                className="px-6 py-2.5 rounded-[9999px] font-bold text-white bg-[#f49700] hover:bg-[#e08900] transition-colors shadow-md text-[14px]"
              >
                Save Points
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}