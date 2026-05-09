import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:translate-y-0 aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-[#e08900] active:translate-y-0 uppercase tracking-[2px] font-black",
        destructive:
          "bg-destructive text-destructive-foreground hover:-translate-y-0.5 hover:bg-destructive/90 active:translate-y-0",
        outline:
          "border-2 border-slate-200 bg-white text-[#0f1c2c] shadow-sm hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0",
        secondary:
          "bg-[#0f1c2c] text-white hover:-translate-y-0.5 hover:bg-[#1a1e2e] active:translate-y-0",
        ghost:
          "text-[#0f1c2c] hover:bg-slate-50 hover:text-[#0f1c2c]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-12 rounded-[16px] px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  pending?: boolean;
  pendingIndicator?: React.ReactNode;
  pendingText?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled,
      pending = false,
      pendingIndicator,
      pendingText,
      size,
      variant,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || pending;
    const content = asChild ? children : (
      <>
        {pending ? pendingIndicator ?? <Spinner /> : null}
        {pending ? pendingText ?? children : children}
      </>
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={pending || undefined}
        aria-disabled={isDisabled || undefined}
        disabled={asChild ? undefined : isDisabled}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
