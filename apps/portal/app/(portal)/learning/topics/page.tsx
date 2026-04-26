"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";

interface PortalTopicListItem {
  _id: string;
  title: string;
  summary: string | null;
  subjectId: string;
  subjectName: string;
  level: string;
  status: "draft" | "active" | "retired";
}

interface PortalTopicIndexData {
  classId: string;
  className: string;
  topics: PortalTopicListItem[];
}

export default function PortalLearningTopicsPage() {
  const data = useQuery(
    "functions/academic/lessonKnowledgePortal:getPortalTopicIndexData" as never,
    {} as never
  ) as PortalTopicIndexData | undefined;
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return data?.topics ?? [];
    }

    return (data?.topics ?? []).filter((topic) => {
      const haystack = [topic.subjectName, topic.title, topic.summary ?? "", topic.level]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data?.topics, searchQuery]);

  const groupedTopics = useMemo(() => {
    const groups = new Map<string, { subjectName: string; topics: PortalTopicListItem[] }>();

    for (const topic of filteredTopics) {
      const key = topic.subjectName.trim().toLowerCase();
      const current = groups.get(key);
      if (current) {
        current.topics.push(topic);
      } else {
        groups.set(key, { subjectName: topic.subjectName, topics: [topic] });
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        topics: [...group.topics].sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [filteredTopics]);

  if (data === undefined) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-slate-500">Loading learning topics…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-500">{data.className}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Learning topics</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Open the approved learning topics prepared for your class. Each topic page shows approved resources and accepts class-scoped supplemental uploads when enabled.
        </p>
      </div>

      <section className="mt-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Available topics</h2>
            <p className="mt-1 text-sm text-slate-500">
              Grouped for {data.className} by subject, then sorted by topic title.
            </p>
          </div>
          <div className="w-full max-w-xl space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Search topics
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search subjects, titles, summaries, or levels"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60"
              />
              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear topic search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">
              Showing {filteredTopics.length} of {data.topics.length} topic{data.topics.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {groupedTopics.length ? (
          <div className="space-y-6">
            {groupedTopics.map((group) => (
              <section key={group.subjectName} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    {group.subjectName}
                  </h3>
                  <span className="text-xs text-slate-400">{group.topics.length} topic{group.topics.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.topics.map((topic) => (
                    <Link
                      key={topic._id}
                      href={`/learning/topics/${topic._id}`}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {group.subjectName}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {topic.level}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">{topic.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {topic.summary ?? "Open this topic to review approved materials and upload class-scoped supplemental resources."}
                          </p>
                        </div>
                        <span className="inline-flex text-sm font-semibold text-slate-900">Open topic →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : searchQuery.trim() ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            <p className="font-semibold text-slate-700">No topics match “{searchQuery.trim()}”.</p>
            <p className="mt-1">Try a different keyword or clear the search.</p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            No active learning topics are available for your class yet.
          </div>
        )}
      </section>
    </div>
  );
}
