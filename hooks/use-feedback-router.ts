"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useNavigationFeedback } from "@/components/providers/navigation-feedback-provider";

type NavigationOptions = {
  scroll?: boolean;
};

export function useFeedbackRouter() {
  const router = useRouter();
  const { completeNavigation, startNavigation } = useNavigationFeedback();

  return {
    back: () => {
      startNavigation();
      startTransition(() => {
        router.back();
      });
    },
    forward: () => {
      startNavigation();
      startTransition(() => {
        router.forward();
      });
    },
    push: (href: string, options?: NavigationOptions) => {
      startNavigation();
      startTransition(() => {
        router.push(href, options);
      });
    },
    refresh: () => {
      startNavigation();
      startTransition(() => {
        router.refresh();
      });
      window.setTimeout(completeNavigation, 500);
    },
    replace: (href: string, options?: NavigationOptions) => {
      startNavigation();
      startTransition(() => {
        router.replace(href, options);
      });
    },
  };
}
