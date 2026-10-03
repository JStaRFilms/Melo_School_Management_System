// Deployment-owned custom host list. The request Host is never populated from
// forwarded headers or a query string. Vercel must route only these custom hosts
// to this production deployment; preview/deployment URLs are not entries.
export function approvedIngressHost(host: string): boolean {
  const configured = process.env.SITES_PRODUCTION_CUSTOM_HOSTS;
  if (!configured || configured.length > 16_384 || !host || host.endsWith(".vercel.app")) return false;
  const entries = configured.split(",").map(value => value.trim());
  return entries.length <= 100 && entries.every(value => value === value.toLowerCase() && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value) && value.includes(".") && !value.endsWith(".vercel.app")) && entries.includes(host);
}
