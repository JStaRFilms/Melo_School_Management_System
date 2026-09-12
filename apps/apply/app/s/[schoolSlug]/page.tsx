import { SchoolLanding } from "@/components/AdmissionsApply";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string }> }) { const { schoolSlug } = await params; return <SchoolLanding schoolSlug={schoolSlug} />; }
