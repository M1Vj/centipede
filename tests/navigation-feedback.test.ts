import { describe, expect, test } from "vitest";
import { shouldTrackNavigation } from "@/lib/navigation-feedback";

describe("shouldTrackNavigation", () => {
  test("tracks plain internal navigations to a different route", () => {
    expect(
      shouldTrackNavigation({
        href: "/mathlete",
        currentPathname: "/",
        currentSearch: "",
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
        target: undefined,
        download: false,
      }),
    ).toBe(true);
  });

  test("skips modified clicks, downloads, and same-page navigations", () => {
    expect(
      shouldTrackNavigation({
        href: "/mathlete",
        currentPathname: "/",
        currentSearch: "",
        button: 0,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
        target: undefined,
        download: false,
      }),
    ).toBe(false);

    expect(
      shouldTrackNavigation({
        href: "/?tab=latest",
        currentPathname: "/",
        currentSearch: "?tab=latest",
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
        target: undefined,
        download: false,
      }),
    ).toBe(false);

    expect(
      shouldTrackNavigation({
        href: "/reports.csv",
        currentPathname: "/",
        currentSearch: "",
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
        target: undefined,
        download: true,
      }),
    ).toBe(false);
  });
});
