import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 px-2 py-4 sm:px-4">
        <div className="shell">
          <div className="flex min-h-16 items-center justify-between gap-3 rounded-full border border-slate-600/50 bg-[#10182b]/95 px-3 py-2 text-slate-100 shadow-[0_26px_58px_-34px_rgba(2,6,23,0.9)] backdrop-blur-xl sm:px-5">
            <ProgressLink href="/protected" className="flex items-center gap-3 rounded-full px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10182b]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f49700] text-xs font-black uppercase tracking-[0.16em] text-[#10182b]">
                Pr
              </div>
              <div className="leading-tight hidden sm:block">
                <p className="text-xs font-bold text-[#f49700]">Protected</p>
                <p className="text-[11px] text-slate-300">Workspace</p>
              </div>
            </ProgressLink>
            <div className="flex items-center gap-3">
              <LogoutButton
                label="Sign out"
                ariaLabel="Sign out of protected workspace"
                variant="outline"
                size="sm"
                className="border-white/25 bg-white/5 text-slate-100 hover:bg-white/15 hover:text-white focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10182b]"
              />
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
