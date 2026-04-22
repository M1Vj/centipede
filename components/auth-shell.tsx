import type { ReactNode } from "react";
import { ProgressLink } from "@/components/ui/progress-link";

type AuthShellMode = "login" | "sign-up" | "forgot-password";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode?: AuthShellMode;
  children: ReactNode;
};

const authSwitch = [
  { label: "Log In", href: "/auth/login", mode: "login" as const },
  { label: "Sign Up", href: "/auth/sign-up", mode: "sign-up" as const },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  mode = "login",
  children,
}: AuthShellProps) {
  const showModeSwitch = mode === "login" || mode === "sign-up";

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F121A] px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        {/* Radial gradient glow */}
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(244,151,0,0.12),_transparent_70%)]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(244,151,0,0.06),_transparent_70%)]" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Back to home link */}
      <ProgressLink
        href="/"
        className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white sm:left-8 sm:top-8"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rotate-180">
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Home
      </ProgressLink>

      <div className="relative z-10 mx-auto w-full max-w-[1080px]">
        <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#1A1E2E]/60 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
            {/* Left panel — dark showcase */}
            <aside className="relative flex flex-col justify-between overflow-hidden bg-[#1A1E2E] px-7 py-9 text-white sm:px-10 sm:py-12">
              {/* Decorative geometric shapes */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-[240px] w-[240px] rounded-full border border-[#F49700]/20 opacity-60" />
              <div className="pointer-events-none absolute -right-6 -top-6 h-[180px] w-[180px] rounded-full border border-[#F49700]/10 opacity-40" />
              <div className="pointer-events-none absolute bottom-[20%] left-[-30%] h-[300px] w-[300px] rounded-full bg-[#F49700]/[0.04] blur-3xl" />



              <div className="relative">
                <span className="inline-flex items-center gap-3">
                  <img src="/mathwiz-logo.svg" alt="MathWiz" className="h-16 w-16 object-contain" />
                  <span className="text-[2rem] font-bold tracking-[-0.04em] text-white">MathWiz</span>
                </span>

                <div className="mt-12 max-w-[320px]">
                  <h2 className="font-sans text-[2.1rem] font-bold leading-[1.05] tracking-[-0.05em] text-white sm:text-[2.45rem]">
                    Leonhard Euler (1707–1783)
                  </h2>
                  <p className="mt-6 text-[1.05rem] leading-8 text-white/70">
                    Did you know that Euler introduced much of modern mathematical notation,
                    including <span className="font-bold italic text-[#F49700]">f(x)</span> for functions,
                    <span className="font-bold italic text-[#F49700]"> e</span> for the base of natural logs,
                    <span className="font-bold italic text-[#F49700]"> i</span> for the square root of -1, and{" "}
                    <span className="font-bold italic text-[#F49700]">π</span> for the circle ratio.
                  </p>
                </div>
              </div>

              <div className="relative mt-14 border-t border-white/10 pt-8">
                <div className="flex items-center">
                  {["JR", "AC", "MW"].map((avatar, index) => (
                    <span
                      key={avatar}
                      className={`flex size-10 items-center justify-center rounded-full border-2 border-[#F49700]/60 bg-[#1A1E2E] text-xs font-bold text-[#F49700] ${
                        index > 0 ? "-ml-2" : ""
                      }`}
                    >
                      {avatar}
                    </span>
                  ))}
                  <span className="-ml-2 inline-flex size-10 items-center justify-center rounded-full border-2 border-[#F49700]/60 bg-[#F49700] text-xs font-bold text-white">
                    +2k
                  </span>
                </div>

              </div>
            </aside>

            {/* Right panel — form area */}
            <div className="bg-[#FAFAFB] px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
              <div className="mx-auto flex w-full max-w-[384px] flex-col gap-8">
                {showModeSwitch ? (
                  <nav
                    className="mx-auto grid w-full max-w-[320px] grid-cols-2 rounded-full border border-slate-200 bg-slate-100 p-1 shadow-sm"
                    aria-label="Authentication mode"
                  >
                    {authSwitch.map((item) => {
                      const active = mode === item.mode;

                      return (
                        <ProgressLink
                          key={item.mode}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`rounded-full px-4 py-2.5 text-center text-sm font-bold transition-all duration-200 ${
                            active
                              ? "bg-white text-[#0f172a] shadow-md"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {item.label}
                        </ProgressLink>
                      );
                    })}
                  </nav>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F49700]">
                    {eyebrow}
                  </p>
                  <h1 className="mt-3 font-sans text-[2.15rem] font-extrabold tracking-[-0.05em] text-[#1A1E2E]">
                    {title}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
                </div>

                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
