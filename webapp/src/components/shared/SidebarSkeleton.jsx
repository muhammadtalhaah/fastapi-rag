// Placeholder rows shown while the durable conversation history is loading, so
// the recents area doesn't pop in. Mirrors the spacing of a real recent row.
// Staggered widths so the placeholder reads as a list of varied titles.
const WIDTHS = ["w-[85%]", "w-[60%]", "w-[75%]", "w-[50%]", "w-[80%]", "w-[65%]"];

const SidebarSkeleton = ({ rows = 6 }) => {
  return (
    <div className="px-3 pb-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <div className={`h-3 animate-pulse bg-rule/50 ${WIDTHS[i % WIDTHS.length]}`} />
        </div>
      ))}
    </div>
  );
};

export default SidebarSkeleton;
