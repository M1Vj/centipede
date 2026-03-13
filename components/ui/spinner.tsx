import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return (
    <svg
      aria-hidden="true"
      data-testid="button-spinner"
      viewBox="0 0 24 24"
      className={cn("size-4 animate-spin text-current", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="opacity-20"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6V3Z"
      />
    </svg>
  );
}
