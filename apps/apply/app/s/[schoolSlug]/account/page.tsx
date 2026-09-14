import { GuardianAccount } from "@/components/AdmissionsApply";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string }> }) { const { schoolSlug } = await params; return <GuardianAccount schoolSlug={schoolSlug} />; }
