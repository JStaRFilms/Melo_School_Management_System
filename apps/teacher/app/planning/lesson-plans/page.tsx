import Link from "next/link";

type SearchParams = Record<string, string | string[] | undefined>;

function parseSourceIds(sourceIds: string | string[] | undefined) {
  const value = Array.isArray(sourceIds) ? sourceIds[0] : sourceIds;

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function LessonPlansPlaceholderPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sourceIds = parseSourceIds(searchParams?.sourceIds);

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
          Lesson Plans
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          The lesson-plan workspace is next.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
          This route is ready for source handoff from the teacher library. When T10 ships, it will read the same deterministic query string and open with the selected source materials preloaded.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Source ids received
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {sourceIds.length > 0 ? sourceIds.join(", ") : "No sources selected yet."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/planning/library"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Back to library
          </Link>
        </div>
      </section>
    </div>
  );
}
