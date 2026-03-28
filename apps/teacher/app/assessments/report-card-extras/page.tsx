import { redirect } from "next/navigation";

export default function ReportCardExtrasLegacyPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
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
