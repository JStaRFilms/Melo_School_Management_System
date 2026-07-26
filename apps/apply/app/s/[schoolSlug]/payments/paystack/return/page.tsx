import { GuardianSurface } from "../../../../../../components/GuardianSurface";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ schoolSlug: string }>; searchParams: Promise<{ reference?: string }> }) { const { schoolSlug } = await params; const { reference } = await searchParams; return <GuardianSurface schoolSlug={schoolSlug} paymentReference={reference} />; }
