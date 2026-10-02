// @vitest-environment node
import {expect, test} from "vitest";
import {probeResolvedTlsEndpoints} from "./providerNode";

const evidence = (fingerprint: string, expires: number) => ({
  leafFingerprintSha256: fingerprint.repeat(64), leafNotAfter: expires,
  deploymentProbeMatched: true as const,
});

test("mixed A and AAAA candidates each pass; earliest expiry wins over representative leaf", async () => {
  const ips = ["8.8.8.8", "2606:4700:4700::1111", "1.1.1.1"];
  const seen: string[] = [];
  const result = await probeResolvedTlsEndpoints(ips, async ip => {
    seen.push(ip);
    return evidence(ip === ips[1] ? "b" : "a", ip === ips[1] ? 200 : 300);
  });
  expect(seen).toEqual(ips);
  expect(result).toEqual(evidence("a", 200));
});

test("a bad second address denies the whole result and waits for in-flight peers", async () => {
  const ips = Array.from({length: 9}, (_, i) => `8.8.8.${i + 1}`);
  const pending: Array<{resolve: (value: ReturnType<typeof evidence>) => void; reject: (error: Error) => void}> = [];
  const seen: string[] = [];
  let finished = false;
  const result = probeResolvedTlsEndpoints(ips, ip => {
    seen.push(ip);
    return new Promise((resolve, reject) => pending.push({resolve, reject}));
  });
  void result.then(() => {finished = true;}, () => {finished = true;});
  expect(seen).toEqual(ips.slice(0, 4));
  pending[1].reject(Error("Wrong deployment marker"));
  pending[0].resolve(evidence("a", 300));
  pending[2].resolve(evidence("c", 300));
  await Promise.resolve();
  expect(finished).toBe(false);
  pending[3].resolve(evidence("d", 300));
  await expect(result).rejects.toThrow("Wrong deployment marker");
  expect(seen).toEqual(ips.slice(0, 4)); // no next batch after failure
});

test("at most four endpoints run at once across the full 32-address DNS cap", async () => {
  const ips = Array.from({length: 32}, (_, i) => `8.8.8.${i + 1}`);
  let active = 0, peak = 0;
  const result = await probeResolvedTlsEndpoints(ips, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 0));
    active--;
    return evidence("a", 300);
  });
  expect(peak).toBe(4);
  expect(active).toBe(0);
  expect(result.leafNotAfter).toBe(300);
  await expect(probeResolvedTlsEndpoints([...ips, "8.8.8.33"], async () => evidence("a", 300))).rejects.toThrow("Unsafe DNS destination");
});
