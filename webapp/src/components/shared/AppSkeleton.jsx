const AppSkeleton = ({ rows = 6 }) => {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-3 py-2">
          <div className="h-3 w-full animate-pulse rounded bg-rule/60" />
        </div>
      ))}
    </div>
  );
};

export default AppSkeleton;
