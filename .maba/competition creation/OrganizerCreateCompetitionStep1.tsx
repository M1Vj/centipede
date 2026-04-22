import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bell,
  Calendar,
  Infinity,
  User,
  Users,
  Settings,
  Lock,
  Info,
  ArrowLeft,
  ArrowRight,
  Clock,
  CalendarDays
} from "lucide-react";
import imgMathWizLogo from "figma:asset/80242dec49a0e15422af2e36b8832eecb94e9250.png";

export default function OrganizerCreateCompetitionStep2() {
  const navigate = useNavigate();

  // State for selections
  const [scheduleType, setScheduleType] = useState<"scheduled" | "open">("scheduled");
  const [participationType, setParticipationType] = useState<"individual" | "team">("individual");

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

      <div className="w-full max-w-[850px] mt-12 flex flex-col gap-6">
        
        {/* Progress Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[#f49700] text-[13px] font-black uppercase tracking-wider mb-2">Step 2 of 4</div>
              <h1 className="text-[28px] md:text-[32px] font-black text-[#10182b] leading-tight">
                Competition Format and Schedule
              </h1>
            </div>
            <div className="text-right">
              <div className="text-[28px] font-black text-[#10182b] leading-none mb-1">50%</div>
              <div className="text-slate-400 text-[12px] font-bold uppercase tracking-wider">Completed</div>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6">
            <div className="bg-[#f49700] h-full rounded-full transition-all duration-500" style={{ width: '50%' }}></div>
          </div>
          
          <p className="text-slate-500 font-medium text-[15px]">
            Define the availability and timeframe for your mathematics competition.
          </p>
        </div>

        {/* Format Selection Card (Individual vs Team) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full flex flex-col gap-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-[#10182b] font-bold text-[18px]">Competition Format</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setParticipationType("individual")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                participationType === "individual" 
                  ? "border-[#f49700] bg-[#f49700]/5 text-[#10182b]" 
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
              }`}
            >
              <User className={`w-8 h-8 mb-3 ${participationType === "individual" ? "text-[#f49700]" : "text-slate-400"}`} />
              <div className="font-bold text-[16px]">Individual</div>
            </button>
            <button 
              onClick={() => setParticipationType("team")}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                participationType === "team" 
                  ? "border-[#f49700] bg-[#f49700]/5 text-[#10182b]" 
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
              }`}
            >
              <Users className={`w-8 h-8 mb-3 ${participationType === "team" ? "text-[#f49700]" : "text-slate-400"}`} />
              <div className="font-bold text-[16px]">Team-Based</div>
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-2 w-full md:w-1/2">
            <label className="text-[#10182b] font-bold text-[14px]">Max Participants</label>
            <input 
              type="number" 
              defaultValue={50}
              min={3}
              max={100}
              className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
            />
            <div className="text-slate-400 text-[12px] font-medium px-1">
              Validation: Min 3, Max 100
            </div>
          </div>

          <div className="mt-4 bg-[#f49700]/10 rounded-2xl p-5 flex items-start gap-3 border border-[#f49700]/20">
            <Info className="w-5 h-5 text-[#f49700] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[#10182b] font-bold text-[14px]">Pro Tip</span>
              <span className="text-slate-600 text-[13px] font-medium leading-relaxed">
                Individual competitions are best for rapid-fire mental math rounds. Team-based formats encourage collaborative problem solving.
              </span>
            </div>
          </div>
        </div>

        {/* Format Selection Card (Scheduled vs Open) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h2 className="text-[#10182b] font-bold text-[18px]">Format Selection</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setScheduleType("scheduled")}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                scheduleType === "scheduled" 
                  ? "border-[#f49700] bg-[#f49700]/5" 
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${scheduleType === "scheduled" ? "bg-[#f49700] text-white" : "bg-slate-200 text-slate-500"}`}>
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <span className={`font-bold text-[16px] ${scheduleType === "scheduled" ? "text-[#10182b]" : "text-slate-600"}`}>Scheduled</span>
                <span className="text-slate-500 text-[13px] font-medium leading-snug">Fixed date and time for all participants.</span>
              </div>
            </button>

            <button 
              onClick={() => setScheduleType("open")}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                scheduleType === "open" 
                  ? "border-[#f49700] bg-[#f49700]/5" 
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${scheduleType === "open" ? "bg-[#f49700] text-white" : "bg-slate-200 text-slate-500"}`}>
                <Infinity className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <span className={`font-bold text-[16px] ${scheduleType === "open" ? "text-[#10182b]" : "text-slate-600"}`}>Open</span>
                <span className="text-slate-500 text-[13px] font-medium leading-snug">Available over a period with flexible start times.</span>
              </div>
            </button>
          </div>
        </div>

        {/* Dates & Timing Card (Conditionally Hidden when Open is selected) */}
        {scheduleType === "scheduled" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Registration Window */}
              <div className="flex flex-col gap-6">
                <h3 className="text-slate-400 font-bold text-[12px] uppercase tracking-wider">Registration Window</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[#10182b] font-bold text-[14px]">Start Date & Time</label>
                  <div className="relative w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="mm/dd/yyyy, --:-- --"
                      className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl pl-11 pr-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[#10182b] font-bold text-[14px]">End Date & Time</label>
                  <div className="relative w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="mm/dd/yyyy, --:-- --"
                      className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl pl-11 pr-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Competition Timing */}
              <div className="flex flex-col gap-6">
                <h3 className="text-slate-400 font-bold text-[12px] uppercase tracking-wider">Competition Timing</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[#10182b] font-bold text-[14px]">Competition Date</label>
                  <div className="relative w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="mm/dd/yyyy"
                      className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl pl-11 pr-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[#10182b] font-bold text-[14px]">Start Time</label>
                    <input 
                      type="text" 
                      placeholder="--:-- --"
                      className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all text-center placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[#10182b] font-bold text-[14px]">Duration (Min)</label>
                    <input 
                      type="number" 
                      defaultValue={60}
                      className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all text-center"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Auto-Computed Lock */}
            <div className="mt-8 bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-[#f49700]" />
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Auto-Computed Lock</span>
                  <span className="text-[#10182b] font-bold text-[15px]">Competition End Time</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[#10182b] font-black text-[18px]">11:00 AM</div>
                <div className="text-slate-400 text-[11px] font-medium">Based on start time + duration</div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm w-full flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-[#10182b] font-bold text-[18px]">Advanced Settings (Optional)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[#10182b] font-bold text-[14px]">Max Attempts</label>
              <div className="relative w-full">
                <select className="appearance-none w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all">
                  <option value="1">1 Attempt</option>
                  <option value="2">2 Attempts</option>
                  <option value="3">3 Attempts</option>
                  <option value="unlimited">Unlimited</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.41 0.589966L6 5.16997L10.59 0.589966L12 1.99997L6 7.99997L0 1.99997L1.41 0.589966Z" fill="#94A3B8"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[#10182b] font-bold text-[14px]">Buffer Time (Min)</label>
              <input 
                type="number" 
                defaultValue={0}
                className="w-full bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl px-4 py-3.5 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-4 flex items-center justify-between w-full mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-6 py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          <button 
            onClick={() => navigate("/organizer-competitions/create/step3")}
            className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-8 py-3.5 rounded-xl font-bold text-[15px] transition-all shadow-sm hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2"
          >
            Continue to Problems <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}