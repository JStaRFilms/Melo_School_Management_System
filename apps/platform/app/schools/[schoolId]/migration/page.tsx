import Link from "next/link";

export default function PlatformSchoolMigrationPage() {
  return (
    <section role="alert">
      <h1>Tenant migration access unavailable</h1>
      <p>Platform governance does not authorize access to private school import workspaces. A reviewed school operator must use the Admin workspace.</p>
      <p>Platform support and proprietor recovery are not enabled through this route.</p>
      <Link href="/schools">Return to schools</Link>
    </section>
  );
}
