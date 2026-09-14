import { IntakeLanding } from "@/components/AdmissionsApply";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string; intakeSlug: string }> }) { const { schoolSlug, intakeSlug } = await params; return <IntakeLanding schoolSlug={schoolSlug} intakeSlug={intakeSlug} />; }
