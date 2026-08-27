"use client";

import { useState } from "react";
import { Lock, Mail, Phone, MapPin, ExternalLink, X, ShieldAlert, LogOut, HelpCircle } from "lucide-react";

export interface SuspendedSchoolDetails {
  name: string;
  logoUrl?: string | null;
  motto?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  theme?: {
    primaryColor: string;
    accentColor: string;
  };
}

export function SchoolSuspendedLockScreen({
  school,
  onSignOut,
}: {
  school?: SuspendedSchoolDetails | null;
  onSignOut?: () => void;
}) {
  const [showPlatformSupport, setShowPlatformSupport] = useState(false);
  const [showSchoolAdminContact, setShowSchoolAdminContact] = useState(false);

  const hasSchoolContact = Boolean(
    school?.contactEmail || school?.contactPhone || school?.address
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100/70 p-4 font-sans text-slate-900">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* School Crest or Initial */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 shadow-sm text-rose-600">
            <Lock className="h-8 w-8" />
          </div>

          {school?.logoUrl ? (
            <div className="flex items-center justify-center h-12 max-w-[160px] mb-2">
              <img
                src={school.logoUrl}
                alt={school.name || "School Crest"}
                className="max-h-12 max-w-full object-contain"
              />
            </div>
          ) : null}

          <h2 className="text-lg font-black tracking-tight text-slate-900">
            {school?.name || "School Workspace"}
          </h2>
          {school?.motto ? (
            <p className="text-[11px] font-medium text-slate-400 italic mt-0.5">
              "{school.motto}"
            </p>
          ) : null}
        </div>

        {/* Notice Card */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-xs leading-relaxed text-slate-700 space-y-2">
          <div className="flex items-center justify-center gap-1.5 font-bold text-rose-700">
            <ShieldAlert className="h-4 w-4" />
            <span>Workspace Temporarily Suspended</span>
          </div>
          <p className="text-slate-600">
            Access to this institution's management workspace has been paused by platform administration.
          </p>
          <div className="pt-2 text-slate-700 text-xs">
            Please contact{" "}
            <button
              type="button"
              onClick={() => setShowPlatformSupport(true)}
              className="font-bold text-indigo-600 underline hover:text-indigo-800 transition-colors cursor-pointer"
            >
              Melo School Management Platform Support
            </button>{" "}
            or{" "}
            {hasSchoolContact ? (
              <button
                type="button"
                onClick={() => setShowSchoolAdminContact(true)}
                className="font-bold text-indigo-600 underline hover:text-indigo-800 transition-colors cursor-pointer"
              >
                your Admin
              </button>
            ) : (
              <span className="font-semibold text-slate-700">your Admin</span>
            )}
            .
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out / Switch User
            </button>
          )}
        </div>
      </div>

      {/* ─── Platform Support Modal ─── */}
      {showPlatformSupport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Melo Platform Support</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPlatformSupport(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Reach out to the central platform administration team for billing, reactivation, or workspace questions:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Support Desk</div>
                  <a
                    href="mailto:support@melo.school"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    support@melo.school
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct Helpline</div>
                  <span className="font-semibold text-slate-800">+234 (800) 6356-724</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPlatformSupport(false)}
                className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── School Admin Contact Modal ─── */}
      {showSchoolAdminContact && hasSchoolContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {school?.name} Contacts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolAdminContact(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Use these official contact channels to get in touch with the school's administrative office:
            </p>

            <div className="space-y-2.5 text-xs">
              {school?.contactEmail && (
                <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">School Email</div>
                    <a
                      href={`mailto:${school.contactEmail}`}
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      {school.contactEmail}
                    </a>
                  </div>
                </div>
              )}

              {school?.contactPhone && (
                <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">School Phone</div>
                    <span className="font-semibold text-slate-800">{school.contactPhone}</span>
                  </div>
                </div>
              )}

              {school?.address && (
                <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Campus Address</div>
                    <span className="font-semibold text-slate-800">{school.address}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSchoolAdminContact(false)}
                className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
