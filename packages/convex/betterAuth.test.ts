import { describe, expect, it } from "vitest";
import { createConvexJwtPayload } from "./betterAuth";

describe("Convex JWT payload", () => {
  it("preserves public identity claims and uses session creation as the authentication time", () => {
    const authenticatedAt = new Date("2026-09-14T06:00:00.000Z");
    const payload = createConvexJwtPayload({
      user: {
        id: "private-user-id",
        image: "https://example.test/private-avatar.png",
        email: "guardian@example.test",
        emailVerified: true,
        name: "Guardian",
      },
      session: { createdAt: authenticatedAt },
    });

    expect(payload).toEqual({
      email: "guardian@example.test",
      emailVerified: true,
      name: "Guardian",
      authenticatedAt: authenticatedAt.getTime(),
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("image");
  });

  it("accepts the serialized session dates returned by the Convex auth adapter", () => {
    const timestamp = Date.parse("2026-09-14T06:00:00.000Z");
    expect(createConvexJwtPayload({ user: {}, session: { createdAt: "2026-09-14T06:00:00.000Z" } })).toEqual({ authenticatedAt: timestamp });
    expect(createConvexJwtPayload({ user: {}, session: { createdAt: timestamp } })).toEqual({ authenticatedAt: timestamp });
  });

  it("rejects an invalid session creation time", () => {
    expect(() => createConvexJwtPayload({ user: {}, session: { createdAt: "not-a-date" } })).toThrow("Session authentication time is unavailable");
  });
});
