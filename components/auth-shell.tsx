import type { ReactNode } from "react";
import { ProgressLink } from "@/components/ui/progress-link";
import { MathwizBrand } from "@/components/landing/mathwiz-brand";

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
    <section className="px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-[1024px] overflow-hidden rounded-[20px] border border-black/15 bg-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.5)]">
        <div className="grid lg:grid-cols-[minmax(0,0.417fr)_minmax(0,0.583fr)]">
          <aside className="relative flex flex-col justify-between overflow-hidden bg-[#020617] px-7 py-9 text-white sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute left-1/2 top-[-15%] h-[220px] w-[220px] rounded-full border-2 border-white/15" />
            <div className="pointer-events-none absolute left-[54%] top-[-7%] h-[164px] w-[164px] rounded-full border border-white/10" />
            <div className="pointer-events-none absolute left-[45%] top-[6%] h-px w-[260px] rotate-45 bg-white/10" />
            <div className="pointer-events-none absolute left-[45%] top-[6%] h-px w-[260px] -rotate-45 bg-white/10" />

            <div className="relative">
              <MathwizBrand className="text-white" labelClassName="text-[2rem]" size={64} />

              <div className="mt-12 max-w-[320px]">
                <h2 className="font-sans text-[2.1rem] font-bold leading-[1.05] tracking-[-0.05em] text-white sm:text-[2.45rem]">
                  Leonhard Euler (1707–1783)
                </h2>
                <p className="mt-6 text-[1.05rem] leading-8 text-white/80">
                  Did you know that Euler introduced much of modern mathematical notation,
                  including <span className="font-bold italic">f(x)</span> for functions,
                  <span className="font-bold italic"> e</span> for the base of natural logs,
                  <span className="font-bold italic"> i</span> for the square root of -1, and π
                  for the circle ratio.
                </p>
              </div>
            </div>

            <div className="relative mt-14 pt-10">
              <div className="flex items-center">
                {["JR", "AC", "MW"].map((avatar, index) => (
                  <span
                    key={avatar}
                    className={`flex size-10 items-center justify-center rounded-full border-2 border-[#f49700] bg-slate-200 text-xs font-bold text-slate-900 ${
                      index > 0 ? "-ml-2" : ""
                    }`}
                  >
                    {avatar}
                  </span>
                ))}
                <span className="-ml-2 inline-flex size-10 items-center justify-center rounded-full border-2 border-[#f49700] bg-white text-xs font-bold text-[#f49700]">
                  +2k
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-white">
                &quot;MathWiz changed how I see calculus!&quot;
              </p>
            </div>
          </aside>

          <div className="bg-white px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
            <div className="mx-auto flex w-full max-w-[384px] flex-col gap-8">
              {showModeSwitch ? (
                <nav
                  className="mx-auto grid w-full max-w-[320px] grid-cols-2 rounded-full border border-black/10 bg-[#edf2f7] p-1 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]"
                  aria-label="Authentication mode"
                >
                  {authSwitch.map((item) => {
                    const active = mode === item.mode;

                    return (
                      <ProgressLink
                        key={item.mode}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`rounded-full px-4 py-2 text-center text-sm font-bold transition ${
                          active
                            ? "bg-white text-[#0f172a] shadow-[0_8px_18px_-14px_rgba(15,23,42,0.6)]"
                            : "text-slate-500 hover:text-[#0f172a]"
                        }`}
                      >
                        {item.label}
                      </ProgressLink>
                    );
                  })}
                </nav>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {eyebrow}
                </p>
                <h1 className="mt-3 font-sans text-[2.15rem] font-extrabold tracking-[-0.05em] text-[#0f172a]">
                  {title}
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
              </div>

              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
