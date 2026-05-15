export default function SegmentedTabs<T extends string>({
  value,
  items,
  ariaLabel,
  onChange,
}: {
  value: T;
  items: Array<{ value: T; label: string }>;
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-g1" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className="group/tab relative isolate inline-flex h-small items-center justify-center gap-g3 rounded-r3 border-0 bg-transparent px-p6 text-footnote outline-none ring-focus cursor-default select-none hide-focus-ring text-uncontained-default hover:text-uncontained-hover disabled:text-uncontained-disabled data-[selected=true]:text-[var(--text-uncontained-selected)]"
            data-selected={selected ? 'true' : undefined}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-0 -z-[1] rounded-[inherit] ${
                selected
                  ? 'bg-t2'
                  : 'bg-fill-uncontained-default group-hover/tab:bg-fill-uncontained-hover'
              }`}
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
