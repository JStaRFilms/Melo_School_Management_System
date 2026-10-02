import { test, expect } from "@playwright/test";
import { findPrivateReviewRenderer } from "../core/renderer-registry";
import { obhisReviewFixture } from "../core/obhis-review-fixture";
import { validatePrivateReviewFixture } from "../core/private-review";
import { readPrivateReviewAsset } from "../core/private-review-assets";

test("exact renderer lookup and validated immutable private context", () => {
  expect(findPrivateReviewRenderer("obhis-v1", 1)?.key).toBe("obhis-v1");
  for (const key of ["unknown", "OBHIS-v1", "obhis-v2", "__proto__"]) expect(findPrivateReviewRenderer(key, 1)).toBeNull();
  expect(findPrivateReviewRenderer("obhis-v1", 2)).toBeNull();
  expect(Object.isFrozen(obhisReviewFixture)).toBe(true);
  expect(Object.isFrozen(obhisReviewFixture.brand)).toBe(true);
  expect(Object.isFrozen(obhisReviewFixture.assets)).toBe(true);
  expect(Object.keys(obhisReviewFixture.brand)).toEqual(["primaryColor", "accentColor"]);
  expect(obhisReviewFixture.theme["--school-primary"]).toBe("#176c49");
  expect(obhisReviewFixture.theme["--school-accent"]).toBe("#39bcd3");
  expect(obhisReviewFixture.publicationRights).toBe("unverified-backend-records");
  expect(obhisReviewFixture.application).toBeNull();
  expect(() => validatePrivateReviewFixture({ ...obhisReviewFixture, rendererKey: "unknown", application: null })).toThrow();
  expect(() => validatePrivateReviewFixture({ ...obhisReviewFixture, publicationRights: "approved", application: null })).toThrow();
});

test("production opt-in and development opt-out deny before reading files", async () => {
  const previous = process.env;
  try {
    process.env = { ...previous, NODE_ENV: "production", OBHIS_LOCAL_REVIEW: "1" };
    expect(await readPrivateReviewAsset("school-friends")).toBeNull();
    process.env = { ...previous, NODE_ENV: "development", OBHIS_LOCAL_REVIEW: "0" };
    expect(await readPrivateReviewAsset("school-friends")).toBeNull();
    process.env.OBHIS_LOCAL_REVIEW = "1";
    expect(await readPrivateReviewAsset("../school-friends.webp")).toBeNull();
  } finally {
    process.env = previous;
  }
});
