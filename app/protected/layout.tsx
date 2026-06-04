import Image from "next/image";
import { LogoutButton } from "@/components/logout-button";
import { ProgressLink } from "@/components/ui/progress-link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-4">
        <nav className="relative flex w-full max-w-[1024px] items-center justify-between rounded-full border border-white/5 bg-secondary px-5 py-3 shadow-2xl backdrop-blur-md">
          <ProgressLink href="/protected" className="flex items-center gap-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary">
            <Image
              src="/mathwiz-logo.svg"
              alt="MathWiz"
              width={28}
              height={28}
              className="object-contain"
            />
            <span className="text-[14px] font-bold tracking-wide text-primary">Protected</span>
          </ProgressLink>
          <div className="flex items-center gap-3">
            <LogoutButton
              label="Sign out"
              ariaLabel="Sign out of protected workspace"
              variant="outline"
              size="sm"
              className="border-white/25 bg-white/5 text-slate-100 hover:bg-white/15 hover:text-white focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            />
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
