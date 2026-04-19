import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReportCardExtrasLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      params.set(key, value[0]);
    }
  }

  const query = params.toString();
  redirect(
    query
      ? `/assessments/report-card-workbench?${query}`
      : "/assessments/report-card-workbench"
  );
}
