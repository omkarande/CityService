export function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <span
      className={`block animate-shimmer rounded ${className}`}
      style={{
        background:
          'linear-gradient(90deg, #e9edff 0%, #f6f8ff 40%, #e9edff 80%)',
        backgroundSize: '800px 100%',
      }}
    />
  );
}

/** Placeholder rows matching PlatformCard's height, so nothing jumps on load. */
export function PlatformCardSkeleton() {
  return (
    <div className="flex items-center gap-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-md">
      <SkeletonBar className="h-12 w-12 rounded-lg" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="h-4 w-1/3" />
        <SkeletonBar className="h-3 w-1/2" />
        <SkeletonBar className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-md" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <PlatformCardSkeleton key={i} />
      ))}
    </div>
  );
}
