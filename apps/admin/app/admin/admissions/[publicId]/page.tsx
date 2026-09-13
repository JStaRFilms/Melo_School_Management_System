import { ApplicationDetail } from "./ApplicationDetail";

export default async function ApplicationPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <ApplicationDetail publicId={publicId} />;
}
