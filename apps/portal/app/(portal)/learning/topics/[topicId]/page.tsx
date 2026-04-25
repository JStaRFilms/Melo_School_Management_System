import { TopicPage } from "./topic-page";

export default async function LearningTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return <TopicPage topicId={topicId} />;
}
