import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BillingPage from "../app/billing/page";
import type { BillingDashboardData, DashboardFilters } from "../app/billing/types";

const invoice = {
  _id: "invoice-result",
  schoolId: "school-1",
  feePlanId: null,
  selectableCollectionId: "collection-1",
  feePlanApplicationId: null,
  selectionRevision: null,
  canEditOptionalItems: false,
  selectionLockReason: "not_editable",
  studentId: "student-1",
  classId: "class-1",
  sessionId: "session-1",
  termId: "term-1",
  invoiceNumber: "INV-RESULT",
  feePlanNameSnapshot: "Primary books",
  currency: "NGN",
  lineItems: [],
  installmentSchedule: [],
  subtotal: 4500,
  waiverAmount: 0,
  discountAmount: 0,
  totalAmount: 4500,
  amountPaid: 0,
  balanceDue: 4500,
  paymentInstructions: null,
  status: "issued",
  dueDate: 1,
  issuedAt: 1,
  issuedBy: "user-1",
  notes: null,
  lastPaymentId: null,
  lastPaymentAt: null,
  createdAt: 1,
  updatedAt: 1,
} as BillingDashboardData["invoices"][number]["invoice"];

const invoiceRow = {
  invoice,
  studentName: "Ada Okafor",
  className: "Primary 2",
  sessionName: "2026/2027",
  termName: "First term",
};

const dashboard = {
  school: { id: "school-1", name: "School", slug: "school" },
  settings: null,
  paymentGateway: {},
  summary: {},
  feePlans: [],
  applications: [],
  invoices: [invoiceRow],
  payments: [],
  paymentAttempts: [],
  gatewayEvents: [],
} as unknown as BillingDashboardData;

vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    workspaceAccess: {
      state: "ready",
      branch: { schoolId: "school-1" },
      effectiveCapabilities: ["finance.fee_plans.manage", "finance.invoices.issue"],
    },
  }),
}));
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("@school/shared/drafts", () => ({ useDirtyForm: () => async () => true }));
vi.mock("@/useDraftConnection", () => ({ useDraftConnection: () => ({}) }));
vi.mock("@/usePersistentFormDraft", () => ({
  usePersistentFormDraft: () => ({
    status: "idle",
    lastSavedAt: null,
    retrySave: vi.fn(),
    handleDiscardDraft: vi.fn(),
    prepareSubmission: vi.fn(),
    submissionSucceeded: vi.fn(),
    submissionFailed: vi.fn(),
  }),
}));
vi.mock("../app/billing/hooks/useBillingActions", () => ({
  useBillingActions: () => ({
    runAction: vi.fn(),
    recordPayment: vi.fn(),
    createFeePlan: vi.fn(),
    applyFeePlanToClassStudents: vi.fn(),
    createInvoicePaymentLink: vi.fn(),
    saveBillingSettings: vi.fn(),
    saveSchoolPaystackGatewayConfig: vi.fn(),
    validateSchoolPaystackGatewayConfig: vi.fn(),
    createSelectableBillingCollection: vi.fn(),
    issueSelectableBillingItems: vi.fn(),
    updateInvoiceOptionalSelections: vi.fn(),
  }),
}));
vi.mock("../app/billing/hooks/useBillingSortPreferences", () => ({
  useBillingSortPreferences: () => ({
    sortPreferences: {
      invoices: { key: "date", direction: "desc" },
      payments: { key: "date", direction: "desc" },
      plans: { key: "date", direction: "desc" },
    },
    setSortPreferences: vi.fn(),
  }),
}));
vi.mock("../app/billing/hooks/useBillingData", () => ({
  useBillingData: (filters: DashboardFilters) => ({
    data: { ...dashboard, invoices: filters.search ? [] : dashboard.invoices },
    classes: [],
    sessions: [],
    classNameById: new Map(),
    applicationTerms: [],
    selectableCollections: [],
  }),
}));

vi.mock("@/components/ui/AdminSheet", () => ({ AdminSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <>{children}</> : null }));
vi.mock("@/components/ui/AdminSurface", () => ({ AdminSurface: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/drafts/PersistentFormDraftControls", () => ({ PersistentFormDraftControls: () => null }));
vi.mock("../app/billing/components/BillingHeader", () => ({ BillingHeader: () => null }));
vi.mock("../app/billing/components/BillingTabs", () => ({ BillingTabs: () => null }));
vi.mock("../app/billing/components/DashboardSkeleton", () => ({ DashboardSkeleton: () => null }));
vi.mock("../app/billing/components/FeePlanList", () => ({ FeePlanList: () => null }));
vi.mock("../app/billing/components/PaymentTable", () => ({ PaymentTable: () => null }));
vi.mock("../app/billing/components/SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("../app/billing/components/SelectableItemsPanel", () => ({ SelectableItemsPanel: () => null }));
vi.mock("../app/billing/components/InvoiceOptionalChoices", () => ({
  InvoiceOptionalChoices: () => null,
  invoiceHasManageableChoices: () => false,
}));
vi.mock("../app/billing/components/InvoiceTable", () => ({
  InvoiceTable: ({ invoices }: { invoices: BillingDashboardData["invoices"] }) => <div data-testid="ledger-count">{invoices.length}</div>,
}));
vi.mock("../app/billing/components/BillingSidebar", () => ({
  BillingSidebar: ({ onOpenSelectableInvoice }: { onOpenSelectableInvoice: (invoiceId: string) => void }) => (
    <div>
      <button onClick={() => onOpenSelectableInvoice("invoice-result")}>Open created result</button>
      <button onClick={() => onOpenSelectableInvoice("invoice-result")}>Open replayed result</button>
      <button onClick={() => onOpenSelectableInvoice("invoice-result")}>Open skipped result</button>
    </div>
  ),
}));
vi.mock("../app/billing/components/PrintableFinanceModal", () => ({
  PrintableFinanceModal: ({ invoice: row }: { invoice: BillingDashboardData["invoices"][number] }) => <div role="dialog">Opened {row.invoice._id}</div>,
}));

afterEach(cleanup);

async function expectResultOpensUnderFilter(buttonName: string) {
  render(<BillingPage />);
  fireEvent.change(screen.getByPlaceholderText("Search ledger..."), { target: { value: "exclude-result" } });
  expect(screen.getByTestId("ledger-count")).toHaveTextContent("0");

  fireEvent.click(screen.getByRole("button", { name: buttonName }));

  await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Opened invoice-result"));
  expect(screen.getByPlaceholderText("Search ledger...")).toHaveValue("");
}

describe("billing issuance result navigation under dashboard filters", () => {
  it("opens a created invoice after clearing an excluding filter", async () => {
    await expectResultOpensUnderFilter("Open created result");
  });

  it("opens a replayed invoice after clearing an excluding filter", async () => {
    await expectResultOpensUnderFilter("Open replayed result");
  });

  it("opens a resolved skipped-existing invoice after clearing an excluding filter", async () => {
    await expectResultOpensUnderFilter("Open skipped result");
  });
});
