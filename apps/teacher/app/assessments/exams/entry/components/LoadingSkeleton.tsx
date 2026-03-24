export function LoadingSkeleton() {
  return (
    <div className="bg-white border border-obsidian-200 rounded-3xl overflow-hidden shadow-sm">
      {/* Header skeleton - exact match from states mockup */}
      <div className="bg-obsidian-50 p-6 border-b border-obsidian-200">
        <div className="skeleton h-4 w-32 rounded-full" />
      </div>

      {/* Row skeletons - exact match from states mockup */}
      <div className="p-8 space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-6">
            <div className="skeleton w-12 h-12 rounded-full" />
            <div className="space-y-3 flex-1">
              <div className="skeleton h-5 w-48 rounded-md" />
              <div className="skeleton h-3 w-24 rounded-md" />
            </div>
            <div className="skeleton h-12 w-16 rounded-xl" />
            <div className="skeleton h-12 w-16 rounded-xl" />
            <div className="skeleton h-12 w-16 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
