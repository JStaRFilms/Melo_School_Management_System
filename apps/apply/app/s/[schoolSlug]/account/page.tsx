import { AccountSurface } from "../../../../components/GuardianSurface";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ schoolSlug: string }>;
  searchParams: Promise<{ checkout?: string; intake?: string }>;
}) {
  const [{ schoolSlug }, query] = await Promise.all([params, searchParams]);
  return <AccountSurface schoolSlug={schoolSlug} intakeSlug={query.intake} checkoutIntent={query.checkout === "1"} />;
}
