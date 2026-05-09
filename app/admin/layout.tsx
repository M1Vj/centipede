import { connection } from "next/server";
import Image from "next/image";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { ProgressLink } from "@/components/ui/progress-link";
import { AdminWorkspaceNav } from "@/app/admin/admin-workspace-nav";

async function getAdminProfile() {
  await getWorkspaceContext({ requireRole: "admin" });
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  await getAdminProfile();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-4">
        <nav className="relative flex w-full max-w-[1180px] items-center justify-between rounded-full border border-white/5 bg-secondary px-5 py-3 shadow-2xl backdrop-blur-md">
          <ProgressLink
            href="/admin"
            className="flex items-center gap-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
          >
            <Image
              src="/mathwiz-logo.svg"
              alt="MathWiz"
              width={28}
              height={28}
              className="object-contain"
            />
            <span className="text-[14px] font-bold tracking-wide text-primary">Admin</span>
          </ProgressLink>

          <AdminWorkspaceNav />
        </nav>
      </header>

      <main className="relative min-h-[calc(100vh-5rem)]">{children}</main>
    </div>
  );
}
