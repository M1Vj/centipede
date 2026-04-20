"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";

interface WorkspaceMobileNavProps {
  title: string;
  homeHref: string;
  items: Array<{
    href: string;
    label: string;
  }>;
}

export function WorkspaceMobileNav({
  title,
  homeHref,
  items,
}: WorkspaceMobileNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <div className="flex min-h-14 items-center justify-between gap-3">
        <ProgressLink
          href={homeHref}
          className="text-sm font-bold uppercase tracking-widest text-foreground"
        >
          {title}
        </ProgressLink>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={isOpen}
          aria-label={isOpen ? `Close ${title.toLowerCase()} navigation` : `Open ${title.toLowerCase()} navigation`}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {isOpen ? (
        <nav className="grid gap-1 border-t pt-3" aria-label={`${title} mobile navigation`}>
          {items.map((item) => {
            const isActive = pathname === item.href;

            return (
              <ProgressLink
                key={item.href}
                href={item.href}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </ProgressLink>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
