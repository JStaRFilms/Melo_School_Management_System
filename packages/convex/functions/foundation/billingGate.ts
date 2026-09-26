/**
 * Online-checkout gates (consolidation P12). Two gates shared one name with
 * different conjuncts; they are now named separately with identical semantics:
 *
 * - isOnlineCheckoutOffered: DISPLAY gate. Controls whether checkout UI is
 *   offered for an invoice. Reads only the allow flag plus invoice
 *   payability. It deliberately does not check provider secrets: a school
 *   with the flag on but no secret shows checkout and fails at init with a
 *   provider error (unchanged behavior).
 * - isProviderReadyForPayments: READINESS gate. Controls whether payment
 *   initialization proceeds. Requires the flag, a usable secret, and a
 *   ready provider status. Never enables payments with no secret.
 *
 * Usage-contract shapes, metering quota, and bank math are untouched.
 */

export type InvoicePayability = {
  balanceDue: number;
  status: string;
};

const UNPAYABLE_INVOICE_STATUSES = new Set(["paid", "waived", "cancelled"]);

export function isInvoicePayable(invoice: InvoicePayability): boolean {
  return invoice.balanceDue > 0 && !UNPAYABLE_INVOICE_STATUSES.has(invoice.status);
}

export function isOnlineCheckoutOffered(args: {
  allowOnlinePayments: boolean;
  invoice: InvoicePayability;
}): boolean {
  return args.allowOnlinePayments && isInvoicePayable(args.invoice);
}

export type ProviderPaymentStatus =
  | "not_configured"
  | "invalid"
  | "ready"
  | "disabled"
  | "rotation_pending";

const READY_PROVIDER_STATUSES: ReadonlySet<string> = new Set([
  "ready",
  "rotation_pending",
]);

export function isProviderReadyForPayments(args: {
  allowOnlinePayments: boolean;
  hasActiveSecret: boolean;
  providerStatus: string | null | undefined;
}): boolean {
  return (
    args.allowOnlinePayments &&
    args.hasActiveSecret &&
    args.providerStatus !== null &&
    args.providerStatus !== undefined &&
    READY_PROVIDER_STATUSES.has(args.providerStatus)
  );
}
