import React from "react";

export type InvoiceBankInstructions = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  sortCode?: string;
  transferNote?: string;
  label?: string;
  branch?: string;
  iban?: string;
  swift?: string;
};
/** Receives an authorized issued snapshot only. Never fetches current bank configuration. */
export function InvoicePaymentInstructions({
  instructions,
  payable,
  reference,
}: {
  instructions?: InvoiceBankInstructions | null;
  payable: boolean;
  reference: string;
}) {
  if (!payable) return null;
  return (
    <section className="my-3 break-inside-avoid border-t border-slate-300 pt-3 text-sm text-slate-900">
      <h3 className="font-semibold">Bank transfer · {reference}</h3>
      {instructions ? (
        <dl className="space-y-1 break-words">
          {(
            [
              ["Bank", instructions.bankName],
              ["Account name", instructions.accountName],
              ["Account number", instructions.accountNumber],
              ["Currency", instructions.currency],
              ["Branch", instructions.branch],
              ["Sort code", instructions.sortCode],
              ["IBAN", instructions.iban],
              ["SWIFT / BIC", instructions.swift],
              ["Instructions", instructions.transferNote],
            ] as const
          ).map(([label, value]) =>
            value ? (
              <div key={label}>
                <dt className="inline font-medium">{label}: </dt>
                <dd className="inline">{value}</dd>
              </div>
            ) : null,
          )}
          <div>
            <dt className="inline font-medium">Payment reference: </dt>
            <dd className="inline">{reference}</dd>
          </div>
        </dl>
      ) : (
        <p>
          Payment instructions unavailable for this issued invoice. Contact the
          school; current bank settings have not been substituted.
        </p>
      )}
    </section>
  );
}
