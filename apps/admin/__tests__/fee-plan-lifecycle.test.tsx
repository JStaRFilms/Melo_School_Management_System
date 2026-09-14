import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeePlanList } from "../app/billing/components/FeePlanList";
import { BillingTabs } from "../app/billing/components/BillingTabs";
import { PaymentTable } from "../app/billing/components/PaymentTable";
import type { BillingDashboardData } from "../app/billing/types";

type FeePlan = BillingDashboardData["feePlans"][number];

function plan(overrides: Partial<FeePlan> = {}): FeePlan {
  return {
    _id: "plan-1",
    name: "Primary fees",
    currency: "NGN",
    billingMode: "class_default",
    targetClassIds: [],
    lineItems: [{ id: "tuition", label: "Tuition", amount: 5000, category: "tuition", order: 0 }],
    installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 14 },
    isActive: true,
    usage: {
      applicationCount: 0,
      invoiceCount: 0,
      revocableInvoiceCount: 0,
      blockedPaidInvoiceCount: 0,
      cancelledInvoiceCount: 0,
      canDelete: true,
    },
    description: null,
    createdAt: 1,
    updatedAt: 1,
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

const listProps = {
  classNameById: new Map<string, string>(),
  sortKey: "date" as const,
  sortDirection: "desc" as const,
  onSortChange: vi.fn(),
};

describe("delegated billing navigation", () => {
  it("hides legacy configuration from delegated finance users", () => {
    render(
      <BillingTabs
        activeTab="plans"
        onTabChange={vi.fn()}
        showSettings={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Plans" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Config" })).not.toBeInTheDocument();
  });
});

describe("payment reconciliation status", () => {
  it("marks unapplied gateway funds for review instead of confirming them", () => {
    const payments: BillingDashboardData["payments"] = [{
      payment: {
        _id: "payment-1",
        invoiceId: "invoice-1",
        reference: "late-payment",
        gatewayReference: "gateway-1",
        provider: "paystack",
        paymentMethod: "online",
        amountReceived: 5000,
        amountApplied: 0,
        unappliedAmount: 5000,
        applicationStatus: "unapplied",
        status: "successful",
        payerName: null,
        payerEmail: null,
        receivedAt: 1,
        reconciliationStatus: "flagged",
        reconciledAt: null,
        notes: "Payment received after invoice revocation",
      },
      invoiceNumber: "INV-001",
      studentName: "Student",
      className: "Class 1",
      sessionName: "2026/2027",
      termName: "First Term",
    }];

    render(
      <PaymentTable
        payments={payments}
        sortKey="date"
        sortDirection="desc"
      />,
    );

    expect(screen.getByText("Unapplied — review")).toBeInTheDocument();
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument();
  });
});

describe("FeePlanList lifecycle controls", () => {
  it("deletes only an unused plan after confirmation", async () => {
    const onDeletePlan = vi.fn(async () => true);
    render(<FeePlanList {...listProps} plans={[plan()]} onDeletePlan={onDeletePlan} />);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/no application runs or invoices/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(onDeletePlan).toHaveBeenCalledWith("plan-1", "Primary fees"));
  });

  it("keeps archived plans discoverable and restorable without an invoice action", () => {
    const archived = plan({ _id: "plan-archived", name: "Old fees", isActive: false });
    render(
      <FeePlanList
        {...listProps}
        plans={[archived]}
        onRestorePlan={vi.fn(async () => true)}
        onApplyPlan={vi.fn()}
      />,
    );

    expect(screen.queryByText("Old fees")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Archived/ }));
    expect(screen.getByText("Old fees")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bulk Invoice/ })).not.toBeInTheDocument();
  });

  it("requires a reason and reports payment-protected invoices before revocation", async () => {
    const onRevokePlan = vi.fn(async () => true);
    const used = plan({
      usage: {
        applicationCount: 1,
        invoiceCount: 3,
        revocableInvoiceCount: 2,
        blockedPaidInvoiceCount: 1,
        cancelledInvoiceCount: 0,
        canDelete: false,
      },
    });
    render(<FeePlanList {...listProps} plans={[used]} onRevokePlan={onRevokePlan} />);

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke invoices" }));
    expect(screen.getByText(/2 unpaid invoices will be cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/1 paid or partly paid invoice will remain unchanged/i)).toBeInTheDocument();

    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Revoke invoices" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /Reason for revocation/ }), {
      target: { value: "Incorrect approved amount" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(onRevokePlan).toHaveBeenCalledWith("plan-1", "Incorrect approved amount"));
  });
});
