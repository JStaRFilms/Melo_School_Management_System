"use client";

import Link from "next/link";
import { useQuery } from "convex/react";

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

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Available topics</h2>
          <span className="text-sm text-slate-500">{data.topics.length} topics</span>
        </div>

        {data.topics.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.topics.map((topic) => (
              <Link
                key={topic._id}
                href={`/learning/topics/${topic._id}`}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {topic.subjectName}
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
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            No active learning topics are available for your class yet.
          </div>
        )}
      </section>
    </div>
  );
}
