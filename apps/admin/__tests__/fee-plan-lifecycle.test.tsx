import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeePlanList } from "../app/billing/components/FeePlanList";
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
