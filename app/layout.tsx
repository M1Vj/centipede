import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Mathwiz Arena",
  description:
    "A responsive competition platform for mathletes, coaches, and organizers.",
};

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  display: "swap",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${fraunces.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_55%)]" />
            <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
              <div className="shell flex min-h-20 items-center justify-between gap-4 py-4">
                <Link href="/" className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-primary text-primary-foreground shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.85)]">
                    <span className="text-sm font-black uppercase tracking-[0.24em]">
                      Mw
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">
                      Mathwiz Arena
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Math competition platform
                    </p>
                  </div>
                </Link>

                <nav className="flex flex-wrap items-center justify-end gap-2">
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link href="/">Home</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/auth/login">Login</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.85)]"
                  >
                    <Link href="/auth/sign-up">Register</Link>
                  </Button>
                  <ThemeSwitcher />
                </nav>
              </div>
            </header>

            <main className="relative flex-1">{children}</main>

            <footer className="border-t border-border/70 bg-background/60">
              <div className="shell flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>Foundation branch: layout, theme, and Supabase-ready app shell.</p>
                <p>Built with Next.js, Tailwind CSS, Shadcn UI, and Supabase.</p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
