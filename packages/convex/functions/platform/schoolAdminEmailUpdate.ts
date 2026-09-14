import { ConvexError } from "convex/values";

type SchoolAdminEmailUpdateOperations<ReservationId> = {
  acquireReservation: () => Promise<ReservationId>;
  updateAuthEmail: (email: string, emailVerified: boolean) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  revokeSessions: () => Promise<void>;
  synchronizeCanonicalRecords: (reservationId: ReservationId) => Promise<void>;
  releaseReservation: (reservationId: ReservationId) => Promise<void>;
  markReservationForManualReview: (reservationId: ReservationId) => Promise<void>;
};

export async function applySchoolAdminEmailUpdate<ReservationId>(
  currentEmail: string,
  currentEmailVerified: boolean,
  newEmail: string,
  operations: SchoolAdminEmailUpdateOperations<ReservationId>,
): Promise<void> {
  const reservationId = await operations.acquireReservation();
  try {
    await operations.updateAuthEmail(newEmail, false);
    await operations.sendVerificationEmail();
    await operations.revokeSessions();
    await operations.synchronizeCanonicalRecords(reservationId);
  } catch (error) {
    try {
      await operations.updateAuthEmail(currentEmail, currentEmailVerified);
    } catch {
      await operations.markReservationForManualReview(reservationId).catch(() => undefined);
      throw new ConvexError("The email change could not be completed and requires manual review");
    }

    try {
      await operations.releaseReservation(reservationId);
    } catch {
      await operations.markReservationForManualReview(reservationId).catch(() => undefined);
      throw new ConvexError("The email change could not be completed and requires manual review");
    }

    if (error instanceof ConvexError) throw error;
    throw new ConvexError("The email change could not be completed");
  }
}
