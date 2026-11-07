export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-72 animate-pulse rounded-xl bg-ink-800" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-ink-850" />)}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-ink-850" />
    </div>
  );
}
