import React from "react";
import { 
  FileText, 
  Banknote, 
  Settings2, 
  ClipboardList, 
  History 
} from "lucide-react";

export type BillingTab = "overview" | "invoices" | "payments" | "plans" | "settings";

interface BillingTabsProps {
  activeTab: BillingTab;
  onTabChange: (tab: BillingTab) => void;
}

const tabs: { id: BillingTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "invoices", label: "Invoices", icon: <FileText className="h-4 w-4" /> },
  { id: "payments", label: "Payments", icon: <Banknote className="h-4 w-4" /> },
  { id: "plans", label: "Plans", icon: <History className="h-4 w-4" /> },
  { id: "settings", label: "Config", icon: <Settings2 className="h-4 w-4" /> },
];

export function BillingTabs({ activeTab, onTabChange }: BillingTabsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`group flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === tab.id
              ? "bg-slate-900 text-white shadow-sm shadow-slate-900/10"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span className={`transition-colors ${activeTab === tab.id ? "text-white" : "text-slate-400 group-hover:text-slate-900"}`}>
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
