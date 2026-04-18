"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldProps = Omit<ComponentProps<typeof Input>, "className"> & {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  wrapperClassName?: string;
};

export function AuthField({
  icon,
  label,
  id,
  trailing,
  type,
  wrapperClassName,
  ...props
}: AuthFieldProps) {
  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="flex min-h-[3.75rem] items-center border border-slate-200 border-b-[2px] bg-white px-3 text-slate-400 transition focus-within:border-[#f49700] focus-within:text-[#f49700]">
        <span className="mr-3 shrink-0">{icon}</span>
        <Input
          id={id}
          type={type}
          className="h-auto border-0 bg-transparent px-0 py-0 text-base text-[#0f172a] shadow-none placeholder:text-slate-400 focus-visible:ring-0"
          {...props}
        />
        {trailing ? <span className="ml-3 shrink-0 text-slate-400">{trailing}</span> : null}
      </div>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative flex items-center justify-center text-sm text-slate-400">
      <span className="absolute inset-x-0 h-px bg-slate-200" aria-hidden="true" />
      <span className="relative bg-white px-4">Or continue with</span>
    </div>
  );
}

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true">
      <path
        d="M21.8 12.2c0-.75-.07-1.3-.22-1.87H12v3.53h5.63c-.11.88-.72 2.2-2.07 3.1l-.02.12 3.01 2.29.21.02c1.9-1.72 3-4.24 3-7.19Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.75 0 5.06-.89 6.75-2.41l-3.22-2.43c-.86.59-2.02 1-3.53 1-2.69 0-4.98-1.72-5.8-4.12l-.12.01-3.12 2.38-.04.11A10.2 10.2 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.2 14.04A6.06 6.06 0 0 1 5.86 12c0-.71.12-1.39.32-2.04l-.01-.14-3.16-2.41-.1.05A9.87 9.87 0 0 0 2 12c0 1.57.38 3.06 1.05 4.37l3.15-2.33Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.84c1.9 0 3.17.8 3.9 1.47l2.84-2.7C17.05 3.05 14.75 2 12 2 8.05 2 4.66 4.18 3.05 7.36l3.28 2.5C7.13 7.56 9.34 5.84 12 5.84Z"
        fill="#EA4335"
      />
    </svg>
  );
}
