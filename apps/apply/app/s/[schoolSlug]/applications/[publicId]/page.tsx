import { GuardianApplication } from "@/components/AdmissionsApply";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string; publicId: string }> }) { const { schoolSlug, publicId } = await params; return <GuardianApplication schoolSlug={schoolSlug} publicId={publicId} />; }
