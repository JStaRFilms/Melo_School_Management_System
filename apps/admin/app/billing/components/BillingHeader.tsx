import { Banknote, Landmark, ReceiptText, AlertTriangle, LayoutGrid } from "lucide-react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { formatMoney } from "../utils";
import type { BillingDashboardData } from "../types";

interface BillingHeaderProps {
  summary: BillingDashboardData["summary"];
  currency: string;
  onOpenArsenal?: () => void;
}

export function BillingHeader({ summary, currency, onOpenArsenal }: BillingHeaderProps) {
  return (
    <div className="space-y-6">
      <AdminHeader
        title="Billing ledger"
        description="Monitor school-wide collections and outstanding balances."
        actions={
          <button 
            onClick={onOpenArsenal}
            className="lg:hidden flex items-center gap-2 px-4 h-11 rounded-2xl bg-slate-950 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
          >
            <LayoutGrid className="h-4 w-4" />
            Financial Hub
          </button>
        }
      />
      <StatGroup
        stats={[
          {
            label: "Outstanding",
            value: formatMoney(summary.outstandingBalance, currency),
            icon: <Banknote className="h-4 w-4" />,
          },
          {
            label: "Collected",
            value: formatMoney(summary.amountCollected, currency),
            icon: <Landmark className="h-4 w-4" />,
          },
          {
            label: "Invoices",
            value: summary.invoiceCount,
            icon: <ReceiptText className="h-4 w-4" />,
          },
          {
            label: "Overdue",
            value: summary.overdueInvoices,
            icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
          },
        ]}
      />
    </div>
  );
}
