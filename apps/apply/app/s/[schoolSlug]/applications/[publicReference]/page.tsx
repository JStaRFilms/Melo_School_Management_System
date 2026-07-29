import { ApplicationSurface } from "../../../../../components/GuardianSurface";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ schoolSlug: string; publicReference: string }> }) { const { schoolSlug, publicReference } = await params; return <ApplicationSurface schoolSlug={schoolSlug} publicReference={publicReference} />; }
