import { MathleteWorkspaceNav } from "@/components/mathlete/workspace-nav";

export default function MathleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f6f6_0%,#faf7f5_100%)]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[460px] bg-[radial-gradient(circle_at_top,rgba(244,151,0,0.12),transparent_44%)]" />
      <div className="pointer-events-none fixed left-1/2 top-[28rem] h-40 w-40 -translate-x-1/2 rounded-full bg-slate-300/25 blur-3xl" />
      <MathleteWorkspaceNav />
      <main className="relative">{children}</main>
    </div>
  );
}
