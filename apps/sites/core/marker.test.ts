import { expect, it } from "vitest";
import { GET } from "../app/.well-known/school-sites-deployment/route";
it("exposes the exact deployment marker before activation",async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(await response.text()).toBe("school-sites-production-core:v1\n");
});
