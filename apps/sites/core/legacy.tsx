// Explicit development demos only. These records are not published school profiles.
const demos: Record<string, string> = {
  "greenfield.schoolos.localhost": "Greenfield demo",
  "greenfield.localhost": "Greenfield demo",
  "localhost": "Greenfield demo",
  "aster.schoolos.localhost": "Aster demo",
  "aster.localhost": "Aster demo",
};
// Separate local Host adapter; never used for managed tenant or production resolution.
export function legacyDemoFromHeaders(headers: Pick<Headers,"get">) {
  if (process.env.NODE_ENV === "production" || process.env.SITES_ENABLE_LEGACY_DEMOS !== "enabled") return null;
  const raw = headers.get("host");
  if (!raw || raw.length > 253 || raw !== raw.trim() || raw.includes(",")) return null;
  const match = /^(localhost|(?:[a-z0-9-]+\.)+localhost)(?::([0-9]{1,5}))?$/i.exec(raw);
  if (!match || (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) return null;
  return legacyDemo(match[1].toLowerCase());
}
export function legacyDemo(host: string | null): {name:string;canonical:string} | null {
  if (process.env.NODE_ENV === "production" || process.env.SITES_ENABLE_LEGACY_DEMOS !== "enabled" || !host || !Object.prototype.hasOwnProperty.call(demos,host)) return null;
  return {name:demos[host],canonical:host === "aster.localhost" ? "aster.schoolos.localhost" : host === "localhost" || host === "greenfield.localhost" ? "greenfield.schoolos.localhost" : host};
}
export function LegacyDemo({name}:{name:string}) { return <main className="mx-auto max-w-3xl p-10"><h1 className="text-3xl font-semibold">{name}</h1><p className="mt-4">Development demo. No published school content is available here.</p></main>; }
