const AUTH_ROUTE_PREFIXES = [
  "/auth/confirm",
  "/auth/error",
  "/auth/forgot-password",
  "/auth/login",
  "/auth/sign-up",
  "/auth/sign-up-success",
  "/auth/update-password",
];

const PROFILE_COMPLETION_ROUTE = "/profile/complete";

type AuthRedirectArgs = {
  pathname: string;
  isAuthenticated: boolean;
  hasCompletedProfile: boolean;
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
  return pathname === "/" || isAuthRoute(pathname);
}

export function getAuthRedirect({
  pathname,
  isAuthenticated,
  hasCompletedProfile,
}: AuthRedirectArgs) {
  if (!isAuthenticated) {
    return isPublicRoute(pathname) ? null : "/auth/login";
  }

  if (!hasCompletedProfile) {
    return isProfileCompletionRoute(pathname) ? null : PROFILE_COMPLETION_ROUTE;
  }

  if (isAuthRoute(pathname) || isProfileCompletionRoute(pathname)) {
    return "/";
  }

  return null;
}
