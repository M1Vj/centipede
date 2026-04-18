import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { RootChrome } from "@/components/layout/root-chrome";
import { AuthProvider } from "@/components/providers/auth-provider";
import { NavigationFeedbackProvider } from "@/components/providers/navigation-feedback-provider";
import { type AuthProfile, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import {
  getSessionVersionCookieValue,
  isSessionStale,
  isSessionVersionSchemaError,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";
import "katex/dist/katex.min.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Mathwiz Arena",
  description:
    "A responsive competition platform for mathletes, coaches, and organizers.",
};

const poppinsSans = Poppins({
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const poppinsDisplay = Poppins({
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

async function AuthHydrator({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const session = null; // We prioritize the verified user object over the session in SSR

  let profile: AuthProfile | null = null;
  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select(`${PROFILE_SELECT_FIELDS}, session_version`)
      .eq("id", user.id)
      .maybeSingle();
    let nextProfile = data as (AuthProfile & { session_version?: number | null }) | null;

    if (error && isSessionVersionSchemaError(error)) {
      const { data: fallbackData } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_FIELDS)
        .eq("id", user.id)
        .maybeSingle<AuthProfile>();
      nextProfile = (fallbackData as (AuthProfile & { session_version?: number | null }) | null) ?? null;
    }

    const cookieStore = await cookies();
    const sessionVersion = getSessionVersionCookieValue(cookieStore);

    if (!isSessionStale(nextProfile, { sessionVersion })) {
      profile = nextProfile;
    }
  }

  return (
    <AuthProvider
      initialUser={profile ? user : null}
      initialSession={profile ? session : null}
      initialProfile={profile}
    >
      {children}
    </AuthProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${poppinsSans.variable} ${poppinsDisplay.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NavigationFeedbackProvider>
            <Suspense fallback={null}>
              <AuthHydrator>
                <RootChrome>{children}</RootChrome>
              </AuthHydrator>
            </Suspense>
          </NavigationFeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
