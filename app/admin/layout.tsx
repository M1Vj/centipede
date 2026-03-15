import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_SELECT_FIELDS, type AuthProfile } from "@/lib/auth/profile";
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Users, 
  FileText, 
  Library, 
  Trophy, 
  History, 
  Settings,
  Menu
} from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

async function AdminGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", user.id)
    .single<AuthProfile>();

  if (error || profile?.role !== "admin") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have the required permissions to access the admin area.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminLayoutFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center text-muted-foreground">
      <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
      <div className="mt-4 h-4 w-64 bg-muted animate-pulse rounded" />
    </div>
  );
}

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Problem Banks", href: "/admin/problem-banks", icon: Library },
  { label: "Competitions", href: "/admin/competitions", icon: Trophy },
  { label: "Audit Logs", href: "/admin/logs", icon: History },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/20 md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <ProgressLink href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs">
              AD
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">Admin Portal</span>
          </ProgressLink>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <ProgressLink
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </ProgressLink>
          ))}
        </nav>
        <div className="border-t p-4">
          <div className="rounded-xl bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">System Mode</p>
            <p className="mt-1 text-xs font-semibold text-primary">Live Monitoring</p>
          </div>
        </div>
      </aside>

      {/* Mobile Top Nav */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6 md:hidden">
        <ProgressLink href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs">
              AD
            </div>
            <span className="text-sm font-bold uppercase tracking-widest italic">Admin</span>
        </ProgressLink>
        <Button variant="ghost" size="icon">
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <main className="min-h-full">
          <Suspense fallback={<AdminLayoutFallback />}>
            <AdminGuard>{children}</AdminGuard>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// Minimal Button internal implementation to avoid too many imports for now or resolve correctly
function Button({ children, variant, size, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) {
  const variants: Record<string, string> = {
    ghost: "bg-transparent hover:bg-muted text-muted-foreground",
    outline: "border border-input bg-background hover:bg-muted hover:text-accent-foreground",
  };
  const sizes: Record<string, string> = {
    icon: "h-10 w-10 p-0",
  };
  const variantClass = variant ? variants[variant] : "";
  const sizeClass = size ? sizes[size] : "";
  return (
    <button className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
