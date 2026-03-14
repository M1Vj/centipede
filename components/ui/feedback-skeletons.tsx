import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CardSkeletonListProps = {
  className?: string;
  count?: number;
};

export function CardSkeletonList({
  className,
  count = 3,
}: CardSkeletonListProps) {
  return (
    <div className={cn("grid gap-6", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          className="border-border/60 bg-background/70 shadow-sm"
          data-testid="card-skeleton-item"
        >
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-4/5 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type TableSkeletonProps = {
  className?: string;
  columns?: number;
  rows?: number;
};

export function TableSkeleton({
  className,
  columns = 4,
  rows = 5,
}: TableSkeletonProps) {
  return (
    <Card className={cn("border-border/60 bg-background/70 shadow-sm", className)}>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-4 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              data-testid="table-skeleton-row"
              className="grid gap-3 sm:grid-cols-4"
            >
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className="h-10 rounded-xl"
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type FormSkeletonProps = {
  className?: string;
  fields?: number;
};

export function FormSkeleton({ className, fields = 3 }: FormSkeletonProps) {
  return (
    <Card className={cn("border-border/70 bg-background/90 shadow-lg", className)}>
      <CardContent className="space-y-5 p-6">
        <Skeleton className="h-6 w-40 rounded-full" />
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} data-testid="form-skeleton-field" className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-10 rounded-xl" />
      </CardContent>
    </Card>
  );
}

type DetailSectionSkeletonProps = {
  className?: string;
  lines?: number;
};

export function DetailSectionSkeleton({
  className,
  lines = 3,
}: DetailSectionSkeletonProps) {
  return (
    <Card className={cn("surface-card overflow-hidden border-border/60", className)}>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-12 w-4/5" />
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            data-testid="detail-skeleton-line"
            className={cn(
              "h-4 rounded-full",
              index === lines - 1 ? "w-3/5" : "w-full",
            )}
          />
        ))}
      </CardContent>
    </Card>
  );
}
