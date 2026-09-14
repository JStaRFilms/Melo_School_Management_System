import type { PortalBillingInvoice } from "./portal-types";

export function buildPortalPaymentRequest(invoice: PortalBillingInvoice, callbackUrl: string) {
  return {
    invoiceId: invoice.invoiceId,
    callbackUrl,
    ...(invoice.selectionRevision !== null
      ? { expectedSelectionRevision: invoice.selectionRevision }
      : {}),
  };
}
