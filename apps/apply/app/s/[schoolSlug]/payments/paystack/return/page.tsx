import { PaystackReturn } from "@/components/AdmissionsApply";
export default async function Page({ params, searchParams }: { params: Promise<{ schoolSlug: string }>; searchParams: Promise<{ reference?: string }> }) { const [{ schoolSlug }, query] = await Promise.all([params, searchParams]); return <PaystackReturn schoolSlug={schoolSlug} reference={query.reference ?? null} />; }
