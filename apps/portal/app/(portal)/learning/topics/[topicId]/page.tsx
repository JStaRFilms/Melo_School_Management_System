import { Suspense } from "react";
import { TopicPage } from "./topic-page";

export default async function LearningTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">Loading topic…</div>}>
      <TopicPage topicId={topicId} />
    </Suspense>
  );
}
