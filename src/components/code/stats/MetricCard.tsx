export default function MetricCard({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-g1 p-p3 rounded-r4 bg-t2">
      <span className="text-footnote text-t6 truncate">{label}</span>
      <span className={`tabular-nums text-t9 truncate ${small ? 'text-footnote' : 'text-body-semibold'}`}>
        {value}
      </span>
    </div>
  );
}
