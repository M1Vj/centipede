"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  FileText,
  History,
  LayoutDashboard,
  Library,
  Menu,
  Settings,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Applications", href: "/admin/applications", icon: FileText },
  { label: "Problem Banks", href: "/admin/problem-banks", icon: Library },
  { label: "Competitions", href: "/admin/competitions", icon: Trophy },
  { label: "Audit Logs", href: "/admin/logs", icon: History },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminMobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="sticky top-0 z-40 border-b bg-background md:hidden">
      <div className="flex h-16 items-center justify-between px-6">
        <ProgressLink href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">
            AD
          </div>
          <span className="text-sm font-bold uppercase tracking-widest italic">Admin</span>
        </ProgressLink>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close admin navigation" : "Open admin navigation"}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {isOpen ? (
        <nav className="grid gap-1 border-t px-4 py-3">
          {navItems.map((item) => (
            <ProgressLink
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </ProgressLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
