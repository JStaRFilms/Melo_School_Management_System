import { expect, test, vi } from "vitest";
vi.mock("node:dns/promises", () => ({
  resolve4: vi.fn(async () => ["169.254.169.254"]),
  resolve6: vi.fn(async () => []),
  resolveNs: vi.fn(async () => ["ns.synthetic.edu"]),
  Resolver: class { setServers(_servers: string[]) { /* not reached for private NS */ } async resolveTxt() {return [["school-site-v1=synthetic"]];} },
}));
import { resolve4 } from "node:dns/promises";
import { probeTls, ownershipTxt } from "./providerNode";
test("TLS probe never dials a private or metadata DNS answer",async () => {
  await expect(probeTls("school.synthetic.edu")).rejects.toThrow("Unsafe DNS destination");
});
test("TXT verifier refuses private nameservers even if a fake TXT matches",async () => {
  await expect(ownershipTxt("_school-site-verify.school.synthetic.edu","school-site-v1=synthetic")).rejects.toThrow("Unsafe DNS destination");
});
test("independent TXT owner is checked at public authoritative nameservers",async () => {
  vi.mocked(resolve4).mockResolvedValueOnce(["8.8.8.8"]);
  expect(await ownershipTxt("_school-site-verify.school.synthetic.edu","school-site-v1=synthetic")).toBe(true);
});
