import React from "react";
import { Settings2, ShieldCheck, Landmark } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { BillingSettingsDraft, PaystackProviderOverview, PaystackGatewayConfigDraft } from "../types";
import { paymentGatewayStatusLabel, paymentGatewayStatusClasses, formatDateTime } from "../utils";

interface SettingsPanelProps {
  settingsDraft: BillingSettingsDraft;
  onSettingsChange: (settings: BillingSettingsDraft) => void;
  onSaveSettings: (e: React.FormEvent) => void;
  gatewayOverview: PaystackProviderOverview;
  gatewayConfigDraft: PaystackGatewayConfigDraft;
  onGatewayConfigChange: (config: PaystackGatewayConfigDraft) => void;
  onSaveGatewayConfig: () => void;
  onValidateGatewayConfig: () => void;
  selectedGatewayMode: "test" | "live";
  setSelectedGatewayMode: (mode: "test" | "live") => void;
  schoolSlug: string;
}

export function SettingsPanel({
  settingsDraft,
  onSettingsChange,
  onSaveSettings,
  gatewayOverview,
  gatewayConfigDraft,
  onGatewayConfigChange,
  onSaveGatewayConfig,
  onValidateGatewayConfig,
  selectedGatewayMode,
  setSelectedGatewayMode,
  schoolSlug,
}: SettingsPanelProps) {
  const modeState = gatewayOverview.modes[selectedGatewayMode];

  return (
    <div className="space-y-6">
      <AdminSurface className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-slate-900 text-white">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Billing Configuration</h3>
            <p className="text-sm text-slate-500 font-medium text-balance">School-wide financial defaults and merchant routing.</p>
          </div>
        </div>

        <form onSubmit={onSaveSettings} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Invoice Prefix</label>
              <input
                value={settingsDraft.invoicePrefix}
                onChange={(e) => onSettingsChange({ ...settingsDraft, invoicePrefix: e.target.value })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                placeholder={schoolSlug.toUpperCase()}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Default Currency</label>
              <input
                value={settingsDraft.defaultCurrency}
                onChange={(e) => onSettingsChange({ ...settingsDraft, defaultCurrency: e.target.value })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                placeholder="NGN"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Due Days</label>
              <input
                type="number"
                value={settingsDraft.defaultDueDays}
                onChange={(e) => onSettingsChange({ ...settingsDraft, defaultDueDays: e.target.value })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Payment Mode</label>
              <select
                value={settingsDraft.paymentProviderMode}
                onChange={(e) => {
                  const mode = e.target.value as "test" | "live";
                  onSettingsChange({ ...settingsDraft, paymentProviderMode: mode });
                  setSelectedGatewayMode(mode);
                }}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-900 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
              >
                <option value="test">Test mode</option>
                <option value="live">Live mode</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
             <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settingsDraft.allowManualPayments}
                  onChange={(e) => onSettingsChange({ ...settingsDraft, allowManualPayments: e.target.checked })}
                  className="h-5 w-5 rounded-lg border-slate-200 text-slate-900 focus:ring-offset-0 focus:ring-slate-900/20"
                />
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Accept manual cash or transfer receipts</span>
             </label>
             <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settingsDraft.allowOnlinePayments}
                  onChange={(e) => onSettingsChange({ ...settingsDraft, allowOnlinePayments: e.target.checked })}
                  className="h-5 w-5 rounded-lg border-slate-200 text-slate-900 focus:ring-offset-0 focus:ring-slate-900/20"
                />
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Enable student-facing online payment links</span>
             </label>
          </div>

          <button type="submit" className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
            Apply Configuration
          </button>
        </form>
      </AdminSurface>

      <AdminSurface className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Paystack Merchant</h3>
              <p className="text-sm text-slate-500 font-medium">Credential management for {selectedGatewayMode} mode.</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${paymentGatewayStatusClasses(modeState.status)}`}>
            {paymentGatewayStatusLabel(modeState.status)}
          </span>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Public Key</label>
              <input
                value={gatewayConfigDraft.publicKey}
                onChange={(e) => onGatewayConfigChange({ ...gatewayConfigDraft, publicKey: e.target.value })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 font-display font-bold text-slate-900 focus:border-slate-900 transition-all"
                placeholder={modeState.publicKeyMasked ?? "pk_..."}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Secret Key</label>
              <input
                type="password"
                value={gatewayConfigDraft.secretKey}
                onChange={(e) => onGatewayConfigChange({ ...gatewayConfigDraft, secretKey: e.target.value })}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-900 focus:border-slate-900 transition-all"
                placeholder="••••••••••••••••"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSaveGatewayConfig}
              className="px-6 h-11 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all"
            >
              Update Credentials
            </button>
            <button
              onClick={onValidateGatewayConfig}
              className="flex-1 h-11 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="h-4 w-4" /> Verify Connection
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
               <span>Last Verification</span>
               <span className="text-slate-600">{modeState.lastValidatedAt ? formatDateTime(modeState.lastValidatedAt) : "Never"}</span>
            </div>
            {modeState.lastValidationMessage && (
               <p className="text-xs font-medium text-slate-500 pt-1 border-t border-slate-200/50 mt-1">
                 {modeState.lastValidationMessage}
               </p>
            )}
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}
