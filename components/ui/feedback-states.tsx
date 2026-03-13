import type { ComponentType, ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{ className?: string }>;

type StateFrameProps = {
  action?: ReactNode;
  className?: string;
  description?: string;
  icon?: IconComponent;
  role?: "alert" | "status";
  title: string;
};

function StateFrame({
  action,
  className,
  description,
  icon: Icon,
  role,
  title,
}: StateFrameProps) {
  return (
    <Card className={cn("border-border/70 bg-background/90 shadow-lg", className)}>
      <CardContent
        className="flex flex-col items-start gap-4 p-6"
        role={role}
        aria-live={role === "alert" ? "assertive" : role ? "polite" : undefined}
      >
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

type LoadingStateProps = {
  className?: string;
  description?: string;
  title?: string;
};

export function LoadingState({
  className,
  description,
  title = "Loading",
}: LoadingStateProps) {
  return (
    <StateFrame
      className={className}
      title={title}
      description={description}
      role="status"
      icon={({ className: iconClassName }) => (
        <LoaderCircle className={cn("animate-spin", iconClassName)} />
      )}
    />
  );
}

type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: string;
  icon?: IconComponent;
  title: string;
};

export function EmptyState({
  action,
  className,
  description,
  icon = Inbox,
  title,
}: EmptyStateProps) {
  return (
    <StateFrame
      action={action}
      className={className}
      description={description}
      icon={icon}
      title={title}
    />
  );
}

type ErrorStateProps = {
  action?: ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function ErrorState({
  action,
  className,
  description,
  title = "Something went wrong",
}: ErrorStateProps) {
  return (
    <StateFrame
      action={action}
      className={className}
      description={description}
      icon={AlertCircle}
      role="alert"
      title={title}
    />
  );
}

type FormStatusMessageProps = {
  icon?: IconComponent;
  message?: string | null;
  status: "error" | "pending" | "success";
};

export function FormStatusMessage({
  icon: Icon,
  message,
  status,
}: FormStatusMessageProps) {
  if (!message) {
    return null;
  }

  const ResolvedIcon =
    Icon ??
    (status === "error"
      ? AlertCircle
      : status === "pending"
        ? ({ className }: { className?: string }) => (
            <Spinner className={cn("size-4", className)} />
          )
        : Inbox);

  return (
    <Alert
      variant={status === "error" ? "destructive" : "default"}
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "error" ? "assertive" : "polite"}
    >
      <ResolvedIcon className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
