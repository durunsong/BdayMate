import { Skeleton } from '@/components/ui';
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="正在加载">
      <Skeleton className="skeleton-title" />
      <div className="stats-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="skeleton-stat" />
        ))}
      </div>
      <Skeleton className="skeleton-panel" />
      <Skeleton className="skeleton-panel" />
    </div>
  );
}
