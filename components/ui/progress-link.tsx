"use client";

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { shouldTrackNavigation } from "@/lib/navigation-feedback";

type ProgressLinkProps = {
  children: ReactNode;
  className?: string;
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean | null;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">;

export const ProgressLink = forwardRef<HTMLAnchorElement, ProgressLinkProps>(
  ({ children, className, href, onClick, prefetch, ...props }, ref) => {
    const feedbackRouter = useFeedbackRouter();
    void prefetch;

    return (
      <a
        ref={ref}
        href={href}
        className={className}
        onClick={(event) => {
          onClick?.(event);

          if (
            shouldTrackNavigation({
              href,
              currentPathname: window.location.pathname,
              currentSearch: window.location.search,
              button: event.button,
              metaKey: event.metaKey,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
              defaultPrevented: event.defaultPrevented,
              target: event.currentTarget.target || undefined,
              download: event.currentTarget.hasAttribute("download"),
            })
          ) {
            event.preventDefault();
            feedbackRouter.push(href);
          }
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
);

ProgressLink.displayName = "ProgressLink";
