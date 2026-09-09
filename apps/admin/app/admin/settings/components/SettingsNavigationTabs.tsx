"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Mail, Network, Hash } from "lucide-react";

interface SettingsNavTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_TABS: SettingsNavTab[] = [
  {
    label: "School Profile & Branding",
    href: "/admin/settings",
    icon: Building2,
  },
  {
    label: "Institutional Email",
    href: "/admin/settings/email-domains",
    icon: Mail,
  },
  {
    label: "Group Defaults",
    href: "/admin/settings/group-defaults",
    icon: Network,
  },
  {
    label: "Admission Numbering",
    href: "/admin/settings/admission-numbering",
    icon: Hash,
  },
];

export function SettingsNavigationTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sub-navigation"
      className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2 custom-scrollbar"
    >
      {SETTINGS_TABS.map((tab) => {
        const isActive =
          tab.href === "/admin/settings"
            ? pathname === "/admin/settings"
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              isActive
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
