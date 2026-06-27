// Placeholder transcript shown while a saved conversation is being fetched.
// Mirrors MessageTurn's layout — right-aligned user bubbles, left-aligned
// assistant blocks — so the loading state matches the shape of the real content
// and there's no jarring reflow once messages arrive.
const Bar = ({ className = "" }) => (
  <div className={`h-3 animate-pulse rounded bg-rule/60 ${className}`} />
);

// One user bubble + one assistant answer, alternating widths so successive
// turns don't look mechanically identical.
const Turn = ({ userWidth, lines }) => (
  <>
    {/* User bubble — right aligned, matches MessageTurn's surface chip. */}
    <div className="flex justify-end">
      <div className={`border border-rule bg-surface px-4 py-3 ${userWidth}`}>
        <Bar className="w-full" />
      </div>
    </div>
    {/* Assistant answer — left aligned block of lines. */}
    <div className="flex flex-col gap-2.5">
      {lines.map((w, i) => (
        <Bar key={i} className={w} />
      ))}
    </div>
  </>
);

const ChatSkeleton = () => {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Turn userWidth="w-40" lines={["w-full", "w-11/12", "w-3/4"]} />
      <Turn userWidth="w-56" lines={["w-full", "w-full", "w-5/6", "w-2/3"]} />
      <Turn userWidth="w-32" lines={["w-11/12", "w-4/5"]} />
    </div>
  );
};

export default ChatSkeleton;
