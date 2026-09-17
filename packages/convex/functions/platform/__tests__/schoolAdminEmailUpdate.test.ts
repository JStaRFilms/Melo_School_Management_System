import { expect, it } from "vitest";
import { applySchoolAdminEmailUpdate } from "../schoolAdminEmailUpdate";

it("compensates a revocation failure before releasing the reservation and retries deterministically", async () => {
  let authEmail = "old@example.test";
  let canonicalEmail = "old@example.test";
  let failRevocation = true;
  let reservationNumber = 0;
  const events: string[] = [];
  const operations = {
    acquireReservation: async () => {
      reservationNumber += 1;
      const reservationId = `reservation-${reservationNumber}`;
      events.push(`reserve:${reservationId}`);
      return reservationId;
    },
    updateAuthEmail: async (email: string) => {
      events.push(`auth:${email}`);
      authEmail = email;
    },
    sendVerificationEmail: async () => {
      events.push("verification");
    },
    revokeSessions: async () => {
      events.push("revoke");
      if (failRevocation) throw new Error("revocation unavailable");
    },
    synchronizeCanonicalRecords: async (reservationId: string) => {
      events.push(`synchronize:${reservationId}`);
      canonicalEmail = authEmail;
    },
    releaseReservation: async (reservationId: string) => {
      events.push(`release:${reservationId}`);
    },
    markReservationForManualReview: async (reservationId: string) => {
      events.push(`manual-review:${reservationId}`);
    },
  };

  await expect(applySchoolAdminEmailUpdate(
    "old@example.test",
    true,
    "new@example.test",
    operations,
  )).rejects.toThrow("could not be completed");
  expect(authEmail).toBe("old@example.test");
  expect(canonicalEmail).toBe("old@example.test");
  expect(events).toEqual([
    "reserve:reservation-1",
    "auth:new@example.test",
    "verification",
    "revoke",
    "auth:old@example.test",
    "release:reservation-1",
  ]);

  failRevocation = false;
  await expect(applySchoolAdminEmailUpdate(
    "old@example.test",
    true,
    "new@example.test",
    operations,
  )).resolves.toBeUndefined();
  expect(authEmail).toBe("new@example.test");
  expect(canonicalEmail).toBe("new@example.test");
  expect(events.slice(-5)).toEqual([
    "reserve:reservation-2",
    "auth:new@example.test",
    "verification",
    "revoke",
    "synchronize:reservation-2",
  ]);
});
