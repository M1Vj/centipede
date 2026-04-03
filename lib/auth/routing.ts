const AUTH_ROUTE_PREFIXES = [
  "/auth/confirm",
  "/auth/email-confirmed",
  "/auth/error",
  "/auth/forgot-password",
  "/auth/login",
  "/auth/sign-out",
  "/auth/sign-up",
  "/auth/sign-up-success",
  "/auth/suspended",
  "/auth/update-password",
];

const PROFILE_COMPLETION_ROUTE = "/profile/complete";
const PUBLIC_ROUTES = ["/", "/privacy", "/terms", "/organizer/apply", "/organizer/status"];

type AuthRedirectArgs = {
  pathname: string;
  isAuthenticated: boolean;
  hasCompletedProfile: boolean;
  role?: string | null;
};

function matchesPath(pathname: string, candidate: string) {
  return pathname === candidate || pathname.startsWith(`${candidate}/`);
}

export function isAuthRoute(pathname: string) {
  return AUTH_ROUTE_PREFIXES.some((route) => matchesPath(pathname, route));
}

export function isProfileCompletionRoute(pathname: string) {
  return matchesPath(pathname, PROFILE_COMPLETION_ROUTE);
}

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => matchesPath(pathname, route)) || isAuthRoute(pathname);
}

export function getAuthRedirect({
  pathname,
  isAuthenticated,
  hasCompletedProfile,
  role,
}: AuthRedirectArgs) {
  if (pathname === "/auth/suspended") {
    return null;
  }

  if (!isAuthenticated) {
    return isPublicRoute(pathname) ? null : "/auth/login";
  }

  if (!hasCompletedProfile) {
    return isProfileCompletionRoute(pathname) ? null : PROFILE_COMPLETION_ROUTE;
  }

  // If the user is on an auth route, completion page, or the home page 
  // but is already logged in with a full profile, we redirect them 
  // to their appropriate workspace.
  const isLandingOrAuthRoute = isAuthRoute(pathname) || isProfileCompletionRoute(pathname) || pathname === "/";
  
  if (isLandingOrAuthRoute) {
    if (role === "admin") {
      return "/admin";
    }
    if (role === "organizer") {
      return "/organizer";
    }
    // Only redirect to mathlete if we're not already there
    return pathname === "/mathlete" ? null : "/mathlete";
  }

  return null;
}
