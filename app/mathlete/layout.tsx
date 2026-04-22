import Image from "next/image";
import { ProgressLink } from "@/components/ui/progress-link";
import { MathleteWorkspaceNav } from "@/components/mathlete/workspace-nav";

export default function MathleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fafafb] text-[#1a1e2e]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(244,151,0,0.18),transparent_48%)]" />
        <div className="absolute right-[-8rem] top-20 h-72 w-72 rounded-full bg-[#1a1e2e]/8 blur-3xl" />
        <div className="absolute left-[-5rem] top-[28rem] h-64 w-64 rounded-full bg-[#f49700]/12 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[220px] bg-[linear-gradient(180deg,rgba(26,30,46,0.06),transparent)]" />
      </div>
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-4">
        <nav className="relative flex w-full max-w-[1024px] items-center justify-between rounded-full border border-white/5 bg-[#1a1e2e] px-5 py-3 shadow-2xl backdrop-blur-md">
          <ProgressLink
            href="/mathlete"
            className="flex items-center gap-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1e2e]"
          >
            <Image
              src="/mathwiz-logo.svg"
              alt="MathWiz"
              width={96}
              height={28}
              className="h-7 w-auto object-contain"
            />
            <span className="text-[14px] font-bold tracking-wide text-[#f49700]">
              Mathlete
            </span>
          </ProgressLink>

          <MathleteWorkspaceNav />
        </nav>
      </header>
      <main className="relative pb-20">{children}</main>
    </div>
  );
}
