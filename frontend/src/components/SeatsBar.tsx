export default function SeatsBar({ total, left }: { total: number; left: number }) {
  const pct = Math.round(((total - left) / total) * 100);
  const color =
    left === 0
      ? 'bg-red-500'
      : left <= Math.max(2, total * 0.15)
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs font-medium text-slate-600">
        {left === 0 ? 'Sold out' : `${left} of ${total} seats left`}
      </p>
    </div>
  );
}