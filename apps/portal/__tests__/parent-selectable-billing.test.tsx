import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalBillingView } from "../app/(portal)/components/portal-workspace/PortalBillingView";
import { buildPortalPaymentRequest } from "../lib/portal-billing";
import type {
  PortalBillingData,
  PortalBillingInvoice,
  PortalEligibleBillingCollections,
  PortalWorkspaceData,
} from "../lib/portal-types";

afterEach(() => cleanup());

const workspace: PortalWorkspaceData = {
  school: { id: "school-1", name: "Melo School", logoUrl: null, theme: { primaryColor: "#123456", accentColor: "#654321" } },
  viewer: { userId: "parent-1", name: "Nneka Okafor", role: "parent", schoolId: "school-1" },
  students: [],
  selectedStudentId: "student-1",
  selectedSessionId: "session-1",
  selectedTermId: "term-1",
  selectedStudent: {
    studentId: "student-1", userId: "user-1", name: "Amara Okafor", admissionNumber: "ADM-1",
    classId: "class-1", className: "Primary 2", schoolId: "school-1", schoolName: "Melo School",
    schoolLogoUrl: null, relationship: "Mother", photoUrl: null, isActive: true, enrollmentState: "active",
  },
  activeSession: { id: "session-1", name: "2026/2027" },
  activeTerm: { id: "term-1", name: "First term" },
  selectedReportCard: null,
  history: [],
  notifications: [],
};

const fixedInvoice: PortalBillingInvoice = {
  paymentInstructions: null,
  invoiceId: "invoice-1", studentId: "student-1", invoiceNumber: "INV-1", feePlanName: "Primary books",
  currency: "NGN", totalAmount: 9000, amountPaid: 0, balanceDue: 9000, dueDate: 1, issuedAt: 1,
  status: "issued", canPayOnline: true, selectionRevision: null, canEditOptionalItems: false,
  selectionLockReason: "not_editable", notes: null,
  lineItems: [{ id: "line-1", label: "Workbook", amount: 9000, category: "other", order: 0, isOptional: true, isSelected: true, unitAmount: 4500, quantity: 2 }],
};

const editableInvoice: PortalBillingInvoice = {
  ...fixedInvoice,
  invoiceId: "invoice-optional",
  invoiceNumber: "INV-2",
  feePlanName: "Term fees",
  totalAmount: 10000,
  balanceDue: 10000,
  selectionRevision: 2,
  canEditOptionalItems: true,
  selectionLockReason: null,
  lineItems: [
    { id: "tuition", label: "Tuition", amount: 10000, category: "tuition", order: 0, isOptional: false, isSelected: true, unitAmount: 10000, quantity: 1 },
    { id: "club", label: "Club", amount: 2000, category: "activity", order: 1, isOptional: true, isSelected: false, unitAmount: 2000, quantity: 1 },
  ],
};

const billing: PortalBillingData = {
  selectedStudentId: "student-1",
  school: { id: "school-1", name: "Melo School" },
  settings: { allowOnlinePayments: true, preferredProvider: "paystack", defaultCurrency: "NGN" },
  householdSummary: { studentCount: 1, invoiceCount: 0, totalInvoiced: 0, totalPaid: 0, outstandingBalance: 0 },
  studentSummary: { invoiceCount: 0, totalInvoiced: 0, totalPaid: 0, outstandingBalance: 0 },
  invoices: [],
  payments: [],
};

const collections: PortalEligibleBillingCollections = {
  student: { studentId: "student-1", classId: "class-1", className: "Primary 2" },
  collections: [{
    collectionId: "collection-1", name: "Primary books", description: "Workbooks", currency: "NGN",
    existingInvoiceId: null, canCreateInvoice: true,
    items: [{ itemId: "item-1", label: "Workbook", description: null, unitAmount: 4500, category: "other", order: 0 }],
  }],
};

function renderBilling(overrides: Partial<React.ComponentProps<typeof PortalBillingView>> = {}) {
  const props: React.ComponentProps<typeof PortalBillingView> = {
    workspace,
    billing,
    eligibleCollections: collections,
    billingNotice: null,
    payingInvoiceId: null,
    createInvoice: vi.fn(),
    updateSelections: vi.fn(),
    onPayNow: vi.fn(),
    ...overrides,
  };
  return render(<PortalBillingView {...props} />);
}

describe("Parent selectable billing", () => {
  it("keeps collections separate and creates an invoice only after a valid review", async () => {
    const createInvoice = vi.fn().mockResolvedValue({ invoice: fixedInvoice, replayed: false });
    renderBilling({ createInvoice });

    expect(screen.getByText(/Browsing these options does not add anything to your balance/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose items" }));
    expect(screen.getByRole("button", { name: "Review order" })).toBeDisabled();
    expect(createInvoice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Workbook/ }));
    fireEvent.change(screen.getByLabelText("Quantity for Workbook"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review order" }));
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }));

    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      studentId: "student-1",
      selections: [{ itemId: "item-1", quantity: 2 }],
    })));
    expect(await screen.findByText(/2 × ₦4,500(?:\.00)?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay ₦9,000(?:\.00)? now/ })).toBeEnabled();
  });

  it("removes a locally created invoice when the selected student changes", async () => {
    const createInvoice = vi.fn().mockResolvedValue({ invoice: fixedInvoice, replayed: false });
    const view = renderBilling({ createInvoice });

    fireEvent.click(screen.getByRole("button", { name: "Choose items" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Workbook/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review order" }));
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }));
    expect((await screen.findAllByText(/INV-1/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Pay ₦9,000(?:\.00)? now/ })).toBeInTheDocument();

    const secondStudentWorkspace: PortalWorkspaceData = {
      ...workspace,
      selectedStudentId: "student-2",
      selectedStudent: {
        ...workspace.selectedStudent!,
        studentId: "student-2",
        userId: "user-2",
        name: "Chidi Okafor",
        admissionNumber: "ADM-2",
      },
    };
    view.rerender(
      <PortalBillingView
        workspace={secondStudentWorkspace}
        billing={{ ...billing, selectedStudentId: "student-2" }}
        eligibleCollections={{ ...collections, student: { ...collections.student, studentId: "student-2" } }}
        billingNotice={null}
        payingInvoiceId={null}
        createInvoice={createInvoice}
        updateSelections={vi.fn()}
        onPayNow={vi.fn()}
      />,
    );

    expect(screen.queryByText(/INV-1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay ₦9,000(?:\.00)? now/ })).not.toBeInTheDocument();
    expect(screen.getByText("No invoices for Chidi Okafor right now.")).toBeInTheDocument();
  });

  it("uses the same request key when an uncertain creation is retried", async () => {
    const createInvoice = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({ invoice: fixedInvoice, replayed: true });
    renderBilling({ createInvoice });
    fireEvent.click(screen.getByRole("button", { name: "Choose items" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Workbook/ }));
    fireEvent.click(screen.getByRole("button", { name: "Review order" }));
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }));
    expect(await screen.findByText("We could not confirm whether the invoice was created.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry same order" }));
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(2));
    expect(createInvoice.mock.calls[0][0].requestKey).toBe(createInvoice.mock.calls[1][0].requestKey);
  });

  it.each([
    ["decrement", () => fireEvent.click(screen.getByRole("button", { name: "Decrease Workbook quantity" })), 1],
    ["direct input", (quantity: HTMLElement) => fireEvent.change(quantity, { target: { value: "4" } }), 4],
    ["increment", () => fireEvent.click(screen.getByRole("button", { name: "Increase Workbook quantity" })), 3],
  ])("uses a new request key when %s changes quantity after an uncertain submission", async (_name, changeQuantity, expectedQuantity) => {
    const createInvoice = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({ invoice: fixedInvoice, replayed: false });
    renderBilling({ createInvoice });
    fireEvent.click(screen.getByRole("button", { name: "Choose items" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Workbook/ }));
    const quantity = screen.getByLabelText("Quantity for Workbook");
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review order" }));
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }));
    expect(await screen.findByText("We could not confirm whether the invoice was created.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    changeQuantity(screen.getByLabelText("Quantity for Workbook"));
    fireEvent.click(screen.getByRole("button", { name: "Review order" }));
    fireEvent.click(screen.getByRole("button", { name: "Create invoice" }));

    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(2));
    expect(createInvoice.mock.calls[1][0].requestKey).not.toBe(createInvoice.mock.calls[0][0].requestKey);
    expect(createInvoice.mock.calls[1][0].selections).toEqual([{ itemId: "item-1", quantity: expectedQuantity }]);
  });

  it("sends the current revision, blocks payment while dirty, and handles a stale save", async () => {
    const updateSelections = vi.fn().mockRejectedValue({ data: { code: "SELECTION_CONFLICT", currentRevision: 3 } });
    const onPayNow = vi.fn();
    renderBilling({ billing: { ...billing, invoices: [editableInvoice] }, updateSelections, onPayNow });

    fireEvent.click(screen.getByRole("checkbox", { name: "Include Club" }));
    expect(screen.getByRole("button", { name: /Pay ₦10,000(?:\.00)? now/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    await waitFor(() => expect(updateSelections).toHaveBeenCalledWith(expect.objectContaining({ expectedSelectionRevision: 2 })));
    expect(await screen.findByText("Choices changed elsewhere. We refreshed this invoice. Review the latest total before saving.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include Club" })).not.toBeChecked();
    expect(onPayNow).not.toHaveBeenCalled();
  });

  it("passes the saved selection revision into payment initialization", () => {
    expect(buildPortalPaymentRequest(editableInvoice, "https://portal.test/return")).toEqual({
      invoiceId: "invoice-optional",
      callbackUrl: "https://portal.test/return",
      expectedSelectionRevision: 2,
    });
    expect(buildPortalPaymentRequest(fixedInvoice, "https://portal.test/return")).not.toHaveProperty("expectedSelectionRevision");
  });

  it("keeps student viewers and payment-locked choices read-only", () => {
    const locked = { ...editableInvoice, canEditOptionalItems: false, selectionLockReason: "payment_recorded" as const };
    renderBilling({ workspace: { ...workspace, viewer: { ...workspace.viewer, role: "student" } }, billing: { ...billing, invoices: [locked] }, eligibleCollections: undefined });

    expect(screen.getByText("Purchases can only be created by a linked parent or guardian.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose items" })).not.toBeInTheDocument();
    expect(screen.getByText("Choices are locked because a payment has been recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Include Club" })).not.toBeInTheDocument();
  });
});
