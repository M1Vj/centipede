export type NavigationIntent = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  currentPathname: string;
  currentSearch: string;
  defaultPrevented: boolean;
  download?: boolean;
  href: string;
  metaKey: boolean;
  shiftKey: boolean;
  target?: string;
};

const INTERNAL_BASE_URL = "http://internal.local";

export function shouldTrackNavigation(intent: NavigationIntent) {
  if (
    intent.defaultPrevented ||
    intent.button !== 0 ||
    intent.metaKey ||
    intent.ctrlKey ||
    intent.shiftKey ||
    intent.altKey ||
    intent.download
  ) {
    return false;
  }

  if (intent.target && intent.target !== "_self") {
    return false;
  }

  const nextUrl = new URL(intent.href, INTERNAL_BASE_URL);

  if (nextUrl.origin !== INTERNAL_BASE_URL) {
    return false;
  }

  if (nextUrl.hash) {
    return false;
  }

  return !(
    nextUrl.pathname === intent.currentPathname &&
    nextUrl.search === intent.currentSearch
  );
}
