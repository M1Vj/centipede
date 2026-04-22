import { useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Search,
  Users,
  User,
  Calendar,
  ArrowRight,
  MoreHorizontal,
  Clock,
  CheckCircle2
} from "lucide-react";
import imgMathWizLogo from "figma:asset/80242dec49a0e15422af2e36b8832eecb94e9250.png";

export default function MathleteDashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const liveCompetitions = [
    {
      id: "live-1",
      title: "2024 National Math Olympiad",
      type: "Individual",
      enrolled: 428,
      status: "Enter Arena",
    },
    {
      id: "live-2",
      title: "2024 National Math Olympiad",
      type: "Individual",
      enrolled: 428,
      status: "Resume",
    }
  ];

  const upcomingCompetitions = [
    {
      id: "up-1",
      title: "Algebraic Geometry Sprint 2026",
      type: "Team (3-4)",
      date: "Oct 24, 2026",
      countdown: { days: "02", hours: "14", mins: "30" }
    },
    {
      id: "up-2",
      title: "Algebraic Geometry Sprint 2026",
      type: "Team (3-4)",
      date: "Oct 24, 2026",
      countdown: { days: "02", hours: "14", mins: "30" }
    },
    {
      id: "up-3",
      title: "Algebraic Geometry Sprint 2026",
      type: "Team (3-4)",
      date: "Oct 24, 2026",
      countdown: { days: "02", hours: "14", mins: "30" }
    },
    {
      id: "up-4",
      title: "Algebraic Geometry Sprint 2026",
      type: "Team (3-4)",
      date: "Oct 24, 2026",
      countdown: { days: "02", hours: "14", mins: "30" }
    }
  ];

  const calendarDays = [
    24, 25, 26, 27, 28, 29, 30,
    1, 2, 3, 4, 5, 6, 7,
    8, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21
  ];

  return (
    <div className="min-h-screen bg-[#fafafb] flex flex-col items-center pt-4 pb-24 px-4 font-['Poppins']">
      
      {/* Floating Pill Navbar - Adapted for Mathlete */}
      <nav className="backdrop-blur-md bg-[#1a1e2e] w-full max-w-[1200px] rounded-full px-5 py-3 flex items-center justify-between shadow-2xl border border-white/5 relative z-50">
        <Link to="/" className="flex items-center gap-2 pl-3">
          <img src={imgMathWizLogo} alt="MathWiz" className="h-7 w-auto object-contain" />
          <span className="text-[#f49700] font-bold text-[14px] tracking-wide relative top-[-6px] left-[-8px]">
            Mathlete
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
          <Link to="/mathlete-dashboard" className="text-[#f49700] font-semibold text-[15px] hover:opacity-80 transition-colors">Dashboard</Link>
          <a href="#" className="text-white font-semibold text-[15px] hover:text-[#f49700] transition-colors">Competitions</a>
          <Link to="/mathlete-teams" className="text-white font-semibold text-[15px] hover:text-[#f49700] transition-colors">Teams</Link>
          <a href="#" className="text-white font-semibold text-[15px] hover:text-[#f49700] transition-colors">History</a>
        </div>

        <div className="flex items-center gap-4 pr-2 bg-[#0f121a] rounded-full pl-6 pr-2 py-1">
          <button className="text-[#f49700] hover:text-white transition-colors relative mr-2">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#f49700] shadow-md cursor-pointer hover:bg-[#e08900] transition-colors flex items-center justify-center text-white font-bold text-[13px]">
            J
          </div>
        </div>
      </nav>

      <div className="w-full max-w-[1200px] mt-8 flex flex-col gap-10">
        
        {/* Hero Section */}
        <div className="bg-[#1a1e2e] rounded-3xl p-12 md:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[200px] bg-[#f49700]/10 blur-[100px] pointer-events-none rounded-full"></div>
          
          <div className="text-[#f49700] text-[12px] font-bold uppercase tracking-widest mb-3 relative z-10">
            MATHLETE
          </div>
          <h1 className="text-[40px] md:text-[56px] font-black text-white leading-[1.1] mb-10 relative z-10">
            Welcome back,<br/>
            <span className="text-[#f49700]">Jaaseia</span>
          </h1>

          <div className="w-full max-w-[640px] relative z-10 flex items-center bg-white/5 border border-white/10 rounded-full p-2 pl-6 backdrop-blur-md transition-all focus-within:bg-white/10 focus-within:border-white/20">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find competitions by name, topic, or school..."
              className="flex-1 bg-transparent border-none text-white text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-0 px-4 py-2"
            />
            <button className="bg-[#f49700] hover:bg-[#e08900] text-white px-8 py-3 rounded-full font-bold text-[14px] transition-colors shadow-md">
              SEARCH
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          
          {/* Left Column (Competitions) */}
          <div className="flex flex-col gap-10">
            
            {/* Live Now Section */}
            <div className="flex flex-col gap-5">
              <h2 className="text-[#1a1e2e] font-black text-[22px] uppercase tracking-wide">LIVE NOW</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {liveCompetitions.map((comp) => (
                  <div key={comp.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-700 text-[10px] font-bold uppercase tracking-wider">Live</span>
                          </div>
                          <div className="bg-slate-50 w-[70px] h-3 rounded-full"></div>
                        </div>
                        <button className="text-slate-400 hover:text-[#1a1e2e] p-1 rounded-lg transition-colors">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <h3 className="text-[#1a1e2e] font-bold text-[20px] leading-tight mb-4 pr-4">
                        {comp.title}
                      </h3>
                      
                      <div className="flex items-center gap-5 text-slate-500 text-[13px] font-medium mb-6">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" /> {comp.type}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" /> {comp.enrolled} Enrolled
                        </div>
                      </div>
                    </div>
                    
                    <button className="w-full bg-[#1a1e2e] hover:bg-[#0f121a] text-white py-3.5 rounded-full font-bold text-[15px] transition-colors">
                      {comp.status}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Competitions Section */}
            <div className="flex flex-col gap-5">
              <div className="flex items-end justify-between">
                <h2 className="text-[#1a1e2e] font-black text-[22px] uppercase tracking-wide">UPCOMING COMPETITIONS</h2>
                <a href="#" className="text-slate-400 hover:text-[#f49700] text-[12px] font-bold uppercase tracking-widest transition-colors mb-1">ALL UPCOMING</a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {upcomingCompetitions.map((comp) => (
                  <div key={comp.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <h3 className="text-[#1a1e2e] font-bold text-[18px] leading-tight mb-3 pr-2">
                        {comp.title}
                      </h3>
                      <div className="flex items-center gap-4 text-slate-500 text-[12px] font-medium mb-6">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> {comp.type}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> {comp.date}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <span className="text-[#1a1e2e] font-black text-[20px] leading-none bg-slate-50 p-2 rounded-lg">{comp.countdown.days}</span>
                          <span className="text-slate-400 text-[9px] font-bold uppercase mt-1">Days</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[#1a1e2e] font-black text-[20px] leading-none bg-slate-50 p-2 rounded-lg">{comp.countdown.hours}</span>
                          <span className="text-slate-400 text-[9px] font-bold uppercase mt-1">Hours</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[#1a1e2e] font-black text-[20px] leading-none bg-slate-50 p-2 rounded-lg">{comp.countdown.mins}</span>
                          <span className="text-slate-400 text-[9px] font-bold uppercase mt-1">Min</span>
                        </div>
                      </div>
                      
                      <button className="bg-[#f49700] hover:bg-[#e08900] text-white px-5 py-3 rounded-full font-bold text-[13px] transition-all flex items-center gap-2 shadow-sm">
                        Register Now <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (Sidebar widgets) */}
          <div className="flex flex-col gap-6">
            
            {/* Calendar Widget */}
            <div className="bg-[#1a1e2e] rounded-3xl p-8 shadow-xl flex flex-col">
              <div className="flex justify-between items-center mb-6 text-white">
                <h3 className="font-bold text-[14px] uppercase tracking-widest">April 2026</h3>
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {['SU','MO','TU','WE','TH','FR','SA'].map(day => (
                  <div key={day} className="text-slate-500 text-[10px] font-bold py-2">{day}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center">
                {calendarDays.map((day, idx) => {
                  const isCurrentMonth = idx > 6 && idx < 27; // Rough mock logic
                  const isToday = day === 19 && isCurrentMonth;
                  const hasEvent = day === 6 && isCurrentMonth;
                  const hasEvent2 = day === 11 && isCurrentMonth;
                  
                  return (
                    <div key={idx} className="flex justify-center relative">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-bold ${
                        isToday ? 'bg-[#f49700] text-white shadow-md shadow-[#f49700]/30' :
                        !isCurrentMonth ? 'text-slate-600' :
                        (hasEvent || hasEvent2) ? 'text-[#f49700]' : 'text-white'
                      }`}>
                        {day}
                      </div>
                      {(hasEvent || hasEvent2) && !isToday && (
                        <div className="absolute bottom-0 w-1 h-1 bg-[#f49700] rounded-full"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">NEXT EVENT</h4>
                <div className="bg-white/5 border border-white/5 rounded-[20px] p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-[#f49700]/20 flex items-center justify-center text-[#f49700] shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-white font-bold text-[14px] leading-tight mb-1">Euler's Marathon</h5>
                    <p className="text-slate-400 text-[11px] font-medium">Tomorrow, 09:00 AM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Widget */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#1a1e2e] font-black text-[16px]">Recent Activity</h3>
                <Bell className="w-4 h-4 text-slate-400" />
              </div>
              
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center shrink-0 text-green-500 mt-1">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[#1a1e2e] text-[13px] font-bold leading-snug mb-1">
                      Your registration for Algebraic Geometry Sprint was successful!
                    </p>
                    <p className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 2 minutes ago
                    </p>
                  </div>
                </div>
                
                {/* Additional mocked activity to match aesthetic weight */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 text-[#f49700] mt-1">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[#1a1e2e] text-[13px] font-bold leading-snug mb-1">
                      New practice problems available for Calculus Prep.
                    </p>
                    <p className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 1 hour ago
                    </p>
                  </div>
                </div>
              </div>
              
              <button className="w-full py-3 rounded-full border border-slate-200 text-slate-500 font-bold text-[13px] hover:bg-slate-50 transition-colors mt-auto">
                Clear All Alerts
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
