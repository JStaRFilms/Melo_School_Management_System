import { GuardianSurface } from "../../../components/GuardianSurface";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string }> }) { const { schoolSlug } = await params; return <GuardianSurface schoolSlug={schoolSlug} />; }
