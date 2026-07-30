import { GuardianSurface } from "../../../../../../components/GuardianSurface";
import { paymentReturnReference } from "../../../../../../lib/journey";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ reference?: string | string[]; trxref?: string | string[] }>;
}) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  return <GuardianSurface schoolSlug={schoolSlug} paymentReference={paymentReturnReference(query)} />;
}
