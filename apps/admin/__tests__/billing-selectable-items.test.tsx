import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectableCollectionForm } from "../app/billing/components/forms/SelectableCollectionForm";
import { SelectableIssuanceForm } from "../app/billing/components/forms/SelectableIssuanceForm";
import { InvoiceOptionalChoices } from "../app/billing/components/InvoiceOptionalChoices";
import type { BillingDashboardData, SelectableBillingCollection } from "../app/billing/types";

const students = [{ _id: "student-1", studentName: "Ada Okafor", admissionNumber: "ADM-1" }];
const queryMocks = vi.hoisted(() => ({ dashboard: undefined as { invoices: Array<{ invoice: unknown }> } | undefined }));

vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school-1" } } }),
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = typeof reference === "string" ? reference : "";
    if (name.includes("listTermsBySession")) return [{ _id: "term-1", name: "First term" }];
    if (name.includes("listStudentsByClass")) return students;
    if (name.includes("getBillingDashboard")) return queryMocks.dashboard;
    return [];
  },
}));

afterEach(() => {
  cleanup();
  queryMocks.dashboard = undefined;
});

const collection: SelectableBillingCollection = {
  _id: "collection-1",
  schoolId: "school-1",
  bankAccountId: null,
  name: "Primary books",
  description: "Workbooks",
  currency: "NGN",
  targetClassIds: ["class-1"],
  targetClasses: [{ _id: "class-1", name: "Primary 2" }],
  isActive: true,
  createdAt: 1,
  updatedAt: 1,
  items: [{ _id: "item-1", label: "Mathematics workbook", description: null, unitAmount: 4500, category: "other", order: 0, isActive: true }],
};

describe("selectable billing Admin controls", () => {
  it("keeps an invalid collection draft and marks duplicate names and prices", async () => {
    const createCollection = vi.fn();
    render(<SelectableCollectionForm classes={[{ _id: "class-1", name: "Primary 2" }]} defaultCurrency="NGN" createCollection={createCollection} onCreated={vi.fn()} onForbidden={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add another item" }));
    const names = screen.getAllByLabelText("Item name *");
    fireEvent.change(names[0], { target: { value: "Workbook" } });
    fireEvent.change(names[1], { target: { value: " workbook " } });
    fireEvent.change(screen.getAllByLabelText("Unit price *")[0], { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Create collection" }));

    expect(await screen.findAllByText("Item names must be unique in this collection.")).toHaveLength(2);
    expect(screen.getAllByText("Enter a unit price greater than 0.").length).toBeGreaterThan(0);
    expect(screen.getByText("Select at least one eligible class.")).toBeInTheDocument();
    expect(createCollection).not.toHaveBeenCalled();
    expect((names[0] as HTMLInputElement).value).toBe("Workbook");
  });

  it("retries an uncertain issuance with the same request key", async () => {
    const issueItems = vi.fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ createdInvoices: [], replayedInvoices: [], skippedExistingStudentIds: ["student-1"] });
    render(<SelectableIssuanceForm collections={[collection]} sessions={[{ _id: "session-1", name: "2026/2027" }]} initialCollectionId={collection._id} issueItems={issueItems} onDone={vi.fn()} onForbidden={vi.fn()} onOpenInvoice={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Session *"), { target: { value: "session-1" } });
    fireEvent.change(screen.getByLabelText("Term *"), { target: { value: "term-1" } });
    fireEvent.change(screen.getByLabelText("Eligible class *"), { target: { value: "class-1" } });
    fireEvent.click(screen.getByText("Ada Okafor"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to items" }));
    fireEvent.click(screen.getByText("Mathematics workbook"));
    fireEvent.click(screen.getByRole("button", { name: "Review issuance" }));
    fireEvent.click(screen.getByRole("button", { name: "Create 1 invoice" }));

    expect(await screen.findByRole("button", { name: "Retry same request" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
    await screen.findByText("Issuance complete");
    expect(issueItems).toHaveBeenCalledTimes(2);
    expect(issueItems.mock.calls[0][0].requestKey).toBe(issueItems.mock.calls[1][0].requestKey);
    expect(screen.getByText("Skipped because an invoice already exists (1)")).toBeInTheDocument();
  });

  it("opens created, replayed, and refreshed skipped-existing invoices", async () => {
    const createdInvoice = { _id: "invoice-created", invoiceNumber: "INV-CREATED", totalAmount: 4500, currency: "NGN" } as BillingDashboardData["invoices"][number]["invoice"];
    const replayedInvoice = { _id: "invoice-replayed", invoiceNumber: "INV-REPLAYED", totalAmount: 4500, currency: "NGN" } as BillingDashboardData["invoices"][number]["invoice"];
    const existingInvoice = {
      _id: "invoice-existing",
      invoiceNumber: "INV-EXISTING",
      studentId: "student-1",
      selectableCollectionId: "collection-1",
      sessionId: "session-1",
      termId: "term-1",
      status: "issued",
    } as BillingDashboardData["invoices"][number]["invoice"];
    const issueItems = vi.fn().mockResolvedValue({
      createdInvoices: [createdInvoice],
      replayedInvoices: [replayedInvoice],
      skippedExistingStudentIds: ["student-1"],
    });
    const onOpenInvoice = vi.fn();
    const props = {
      collections: [collection],
      sessions: [{ _id: "session-1", name: "2026/2027" }],
      initialCollectionId: collection._id,
      issueItems,
      onDone: vi.fn(),
      onForbidden: vi.fn(),
      onOpenInvoice,
    };
    const { rerender } = render(<SelectableIssuanceForm {...props} />);

    fireEvent.change(screen.getByLabelText("Session *"), { target: { value: "session-1" } });
    fireEvent.change(screen.getByLabelText("Term *"), { target: { value: "term-1" } });
    fireEvent.change(screen.getByLabelText("Eligible class *"), { target: { value: "class-1" } });
    fireEvent.click(screen.getByText("Ada Okafor"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to items" }));
    fireEvent.click(screen.getByText("Mathematics workbook"));
    fireEvent.click(screen.getByRole("button", { name: "Review issuance" }));
    fireEvent.click(screen.getByRole("button", { name: "Create 1 invoice" }));

    await screen.findByText("Issuance complete");
    const immediateActions = screen.getAllByRole("button", { name: "Open invoice" });
    expect(immediateActions).toHaveLength(2);
    fireEvent.click(immediateActions[0]);
    fireEvent.click(immediateActions[1]);
    expect(onOpenInvoice).toHaveBeenNthCalledWith(1, "invoice-created");
    expect(onOpenInvoice).toHaveBeenNthCalledWith(2, "invoice-replayed");
    expect(screen.getByRole("button", { name: "Finding invoice..." })).toBeDisabled();

    queryMocks.dashboard = { invoices: [{ invoice: existingInvoice }] };
    rerender(<SelectableIssuanceForm {...props} />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Open invoice" })).toHaveLength(3));
    fireEvent.click(screen.getAllByRole("button", { name: "Open invoice" })[2]);
    expect(onOpenInvoice).toHaveBeenNthCalledWith(3, "invoice-existing");
    expect(screen.getByText("INV-EXISTING")).toBeInTheDocument();
  });

  it("sends the current revision and replaces totals with the mutation result", async () => {
    const invoice = {
      _id: "invoice-1", schoolId: "school-1", feePlanId: "plan-1", selectableCollectionId: null, feePlanApplicationId: null,
      selectionRevision: 2, canEditOptionalItems: true, selectionLockReason: null, studentId: "student-1", classId: "class-1", sessionId: "session-1", termId: "term-1", invoiceNumber: "INV-1",
      feePlanNameSnapshot: "Term fees", currency: "NGN", lineItems: [
        { id: "required", label: "Tuition", amount: 10000, category: "tuition", order: 0 },
        { id: "club", label: "Club", amount: 2000, category: "activity", order: 1, isOptional: true, isSelected: false },
      ], installmentSchedule: [], subtotal: 10000, waiverAmount: 0, discountAmount: 0, totalAmount: 10000, amountPaid: 0, balanceDue: 10000,
      paymentInstructions: null, status: "issued", dueDate: 1, issuedAt: 1, issuedBy: "user-1", notes: null, lastPaymentId: null, lastPaymentAt: null, createdAt: 1, updatedAt: 1,
    } as BillingDashboardData["invoices"][number]["invoice"];
    const updated = { ...invoice, selectionRevision: 3, subtotal: 12000, totalAmount: 12000, balanceDue: 12000, lineItems: invoice.lineItems.map((item) => item.id === "club" ? { ...item, isSelected: true } : item) };
    const updateSelections = vi.fn().mockResolvedValue({ invoice: updated, changed: true });
    render(<InvoiceOptionalChoices invoice={invoice} updateSelections={updateSelections} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Estimated total after changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save invoice choices" }));
    await waitFor(() => expect(updateSelections).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: "invoice-1", expectedSelectionRevision: 2 })));
    expect(await screen.findByText(/Invoice choices saved. New balance due/)).toHaveTextContent("₦12,000");
  });

  it("renders an allocation-only lock from the authoritative projection", () => {
    const invoice = {
      _id: "invoice-locked", schoolId: "school-1", feePlanId: "plan-1", selectableCollectionId: null, feePlanApplicationId: null,
      selectionRevision: 4, canEditOptionalItems: false, selectionLockReason: "payment_recorded", studentId: "student-1", classId: "class-1", sessionId: "session-1", termId: "term-1", invoiceNumber: "INV-LOCKED",
      feePlanNameSnapshot: "Term fees", currency: "NGN", lineItems: [
        { id: "required", label: "Tuition", amount: 10000, category: "tuition", order: 0 },
        { id: "club", label: "Club", amount: 2000, category: "activity", order: 1, isOptional: true, isSelected: false },
      ], installmentSchedule: [], subtotal: 10000, waiverAmount: 0, discountAmount: 0, totalAmount: 10000,
      amountPaid: 0, balanceDue: 10000, paymentInstructions: null, status: "issued", dueDate: 1, issuedAt: 1,
      issuedBy: "user-1", notes: null, lastPaymentId: null, lastPaymentAt: null, createdAt: 1, updatedAt: 1,
    } as BillingDashboardData["invoices"][number]["invoice"];
    const updateSelections = vi.fn();

    render(<InvoiceOptionalChoices invoice={invoice} updateSelections={updateSelections} onSaved={vi.fn()} />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText("Choices are locked because a payment has been recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save invoice choices" })).not.toBeInTheDocument();
    expect(updateSelections).not.toHaveBeenCalled();
  });
});
