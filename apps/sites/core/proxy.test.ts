import {expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const {resolvePath} = vi.hoisted(() => ({resolvePath:vi.fn()}));
vi.mock("./gateway",() => ({resolvePath}));
import {proxy} from "../proxy";

const site = {redirectToCanonical:true,canonicalOrigin:"https://school.example.edu",activeHostname:"alias.example.edu",rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"};
it("terminates an unsafe query on an otherwise admitted redirect alias before page rendering",async () => {
  resolvePath.mockResolvedValue({status:"available",site});
  expect((await proxy(new NextRequest("https://alias.example.edu/?x=ok"))).status).toBe(308);
  resolvePath.mockClear();
  const response = await proxy(new NextRequest("https://alias.example.edu/?x=%5c",{headers:{host:"alias.example.edu"}}));
  expect(response.status).toBe(400);
  expect(response.headers.get("x-middleware-next")).toBeNull();
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(resolvePath).not.toHaveBeenCalled();
});
it("redirects known alias routes with safe query intact; denies admitted aliases lacking a redirect",async () => {
  resolvePath.mockResolvedValue({status:"available",site});
  const response = await proxy(new NextRequest("https://alias.example.edu/?lang=yo"));
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("https://school.example.edu/?lang=yo");
  resolvePath.mockResolvedValueOnce({status:"available",site:{...site,canonicalOrigin:"bad"}});
  const invalid = await proxy(new NextRequest("https://alias.example.edu/"));
  expect(invalid.status).toBe(400);
  expect(invalid.headers.get("x-middleware-next")).toBeNull();
});
