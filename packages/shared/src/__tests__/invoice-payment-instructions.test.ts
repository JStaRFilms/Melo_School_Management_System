import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { InvoicePaymentInstructions } from "../components/InvoicePaymentInstructions";
const instructions = {
  bankName: "Synthetic Bank",
  accountName: "School",
  accountNumber: "1234567890",
  currency: "NGN",
  iban: "SYNTHETIC-IBAN",
  swift: "SYNTHBIC",
  transferNote: "Use invoice reference",
};
it("prints full authorized snapshot and international fields, with an explicit legacy missing state", () => {
  const html = renderToStaticMarkup(
    createElement(InvoicePaymentInstructions, {
      instructions,
      payable: true,
      reference: "INV-1",
    }),
  );
  expect(html).toContain(instructions.accountNumber);
  expect(html).toContain(instructions.iban);
  expect(html).toContain("INV-1");
  const legacy = renderToStaticMarkup(
    createElement(InvoicePaymentInstructions, {
      instructions: null,
      payable: true,
      reference: "OLD-1",
    }),
  );
  expect(legacy).toContain("unavailable");
  expect(legacy).not.toContain(instructions.accountNumber);
});
it("omits instructions entirely for receipts and settled views", () => {
  expect(
    renderToStaticMarkup(
      createElement(InvoicePaymentInstructions, {
        instructions,
        payable: false,
        reference: "INV-1",
      }),
    ),
  ).toBe("");
});
