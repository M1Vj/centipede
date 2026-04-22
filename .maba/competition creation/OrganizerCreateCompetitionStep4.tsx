import { Link, useNavigate } from "react-router";
import {
  Bell,
  ArrowLeft,
  ArrowRight,
  FileText,
  Users,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Plus,
  BookOpen
} from "lucide-react";
import imgMathWizLogo from "figma:asset/80242dec49a0e15422af2e36b8832eecb94e9250.png";

export default function OrganizerCreateCompetitionStep5() {
  const navigate = useNavigate();

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
              <div className="text-[#f49700] text-[14px] font-bold uppercase tracking-[0.7px]">Step 5 of 5</div>
              <h1 className="text-[30px] font-bold text-[#1e293b] leading-tight">
                Competition Review
              </h1>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="text-[24px] font-bold text-[#1e293b] leading-none mb-1">99%</div>
              <div className="text-slate-500 text-[14px]">Completed</div>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-6 relative">
            <div className="bg-[#f49700] h-full rounded-full transition-all duration-500 shadow-[0px_0px_10px_0px_rgba(245,159,10,0.4)]" style={{ width: '99%' }}></div>
          </div>
          
          <p className="text-[#475569] text-[16px]">
            Define the availability and timeframe for your mathematics competition.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Column - Summary Cards */}
          <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
            
            {/* Core Information Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col gap-6">
              <h3 className="text-slate-400 font-bold text-[13px] uppercase tracking-wider">Core Information</h3>
              
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#f49700] flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span className="text-slate-400 text-[12px] font-bold uppercase tracking-wide">Description</span>
                    <span className="text-[#10182b] text-[15px] font-semibold mt-0.5">123</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#f49700] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span className="text-slate-400 text-[12px] font-bold uppercase tracking-wide">Participation</span>
                    <span className="text-[#10182b] text-[15px] font-semibold mt-0.5">Individual (12 Max)</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#f49700] flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span className="text-slate-400 text-[12px] font-bold uppercase tracking-wide">Point System</span>
                    <span className="text-[#10182b] text-[15px] font-semibold mt-0.5">Auto-Level (12, 123, 23)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-400 font-bold text-[13px] uppercase tracking-wider">Schedule</h3>
                <button onClick={() => navigate('/organizer-competitions/create/step3')} className="text-[#f49700] font-bold text-[13px] hover:text-[#d97706] transition-colors">
                  Edit
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <span className="text-slate-500 font-medium text-[14px]">Start Date</span>
                  <span className="text-[#10182b] font-bold text-[14px]">Date</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <span className="text-slate-500 font-medium text-[14px]">End Date</span>
                  <span className="text-[#10182b] font-bold text-[14px]">Date here</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium text-[14px]">Duration</span>
                  <span className="text-[#10182b] font-bold text-[14px]">Date here</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-[#f9f5ed] rounded-3xl border border-[#ebdcc1] p-8 shadow-sm flex flex-col gap-5">
              <h3 className="text-[#10182b] font-black text-[16px]">Quick Stats</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-[#f49700] font-black text-[32px] leading-none mb-1">1</span>
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Problem</span>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-[#f49700] font-black text-[32px] leading-none mb-1">158</span>
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Points</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Problem Bank Preview */}
          <div className="flex-1 w-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-center gap-4">
              <div className="w-[50px] h-[50px] rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0">
                <BookOpen className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-[#10182b] font-black text-[18px]">Problem Bank Preview</h2>
                <p className="text-slate-500 text-[13px] font-medium mt-0.5">1 Problem currently in the bank</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 flex flex-col gap-6">
              
              {/* Problem Card */}
              <div className="relative">
                {/* Badge */}
                <div className="absolute -top-3 left-6 bg-[#f49700] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full z-10 shadow-sm">
                  PRACTICE PROBLEM BANK
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-[#10182b] font-black text-[18px]">Problem 1</h3>
                    <div className="flex items-center gap-2">
                      <button className="text-slate-400 hover:text-[#f49700] p-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-5">
                    <p className="text-[#334155] text-[14px] leading-relaxed font-medium">
                      "What is the derivative of f(x) = 12x^2 + 123x + 23 relative to the auto-level point system defined?"
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-600 text-[10px] font-bold uppercase tracking-wide">158 POINTS</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-600 text-[10px] font-bold uppercase tracking-wide">DIFFICULTY: HARD</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-600 text-[10px] font-bold uppercase tracking-wide">TYPE: MULTIPLE CHOICE</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add More Button */}
              <button className="w-full border-2 border-dashed border-slate-200 hover:border-[#f49700] hover:bg-[#f49700]/5 rounded-2xl py-12 flex flex-col items-center justify-center gap-3 transition-colors group">
                <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-[#f49700]/10 flex items-center justify-center border border-slate-200 group-hover:border-[#f49700]/30 transition-colors">
                  <Plus className="w-6 h-6 text-slate-400 group-hover:text-[#f49700]" />
                </div>
                <span className="text-slate-400 group-hover:text-[#f49700] font-bold text-[15px] transition-colors">
                  Add more problems to the problem bank
                </span>
              </button>

            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-4 flex items-center justify-between w-full mb-8">
          <button 
            onClick={() => navigate('/organizer-competitions/create/step4')}
            className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-6 py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          <button 
            onClick={() => navigate('/organizer-competitions')}
            className="bg-[#f49700] hover:bg-[#e08900] text-[#10182b] px-8 py-3.5 rounded-xl font-bold text-[15px] transition-all shadow-sm hover:shadow-lg hover:shadow-[#f49700]/30 flex items-center gap-2"
          >
            Publish Competition <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
