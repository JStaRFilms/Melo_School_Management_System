import { GuardianSurface } from "../../../../../components/GuardianSurface";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string; intakeSlug: string }> }) { const { schoolSlug, intakeSlug } = await params; return <GuardianSurface schoolSlug={schoolSlug} intakeSlug={intakeSlug} />; }
