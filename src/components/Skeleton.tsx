interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--bg-muted)] ${className}`}
      style={{ backgroundImage: "linear-gradient(90deg, var(--bg-muted) 25%, var(--bg-surface) 50%, var(--bg-muted) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }}
    />
  );
}

export function TicketZeileSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <Skeleton className="mb-2 h-2.5 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="mt-1 h-2 w-24" />
    </div>
  );
}
