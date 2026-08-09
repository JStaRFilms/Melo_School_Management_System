"use client";

import { useState } from "react";
import { useConvex } from "convex/react";
import { Plus, ArrowRight, Settings, Trash2, Link } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { appToast, type ApplicationLinkV1 } from "@school/shared";
import { applicationLinkCopyFeedback, resolveAndCopyApplicationLink } from "@/admissions/models";

type Intake = {
  intakeId: string;
  name: string;
  status: string;
  slug?: string;
  opensAt?: number;
  closesAt?: number;
};

interface AdmissionsHubProps {
  intakes: Intake[] | undefined;
  schoolSlug?: string;
  onEnterWorkstation: (intakeId: string, name: string) => void;
  onCreateForm?: () => void;
  onEditForm?: (intakeId: string) => void;
  onDeleteForm?: (intakeId: string) => void;
  onSetIntakeStatus?: (intakeId: string, status: "open" | "paused" | "closed" | "archived") => void;
}

export function AdmissionsHub({ intakes, schoolSlug, onEnterWorkstation, onCreateForm, onEditForm, onDeleteForm, onSetIntakeStatus }: AdmissionsHubProps) {
  const convex = useConvex();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [intakeToDelete, setIntakeToDelete] = useState<{ id: string; name: string; status: string } | null>(null);

  const handleCopyApplicationLink = async (intakeSlug: string | undefined) => {
    const status = await resolveAndCopyApplicationLink({
      schoolSlug,
      intakeSlug,
      resolve: (args) => convex.query(
        "functions/foundation/applicationLinks:getApplicationLink" as never,
        args as never,
      ) as Promise<ApplicationLinkV1>,
    });
    const feedback = applicationLinkCopyFeedback(status);
    if (status === "copied") appToast.success(feedback.title);
    else appToast.error(feedback.title, { description: feedback.description });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
      {/* Main campaigns list */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Campaigns</span>
            <h2 className="font-outfit font-black text-2xl text-slate-900 mt-1">Admission & Enrollment Forms</h2>
            <p className="text-xs text-slate-500 mt-1">Create enrollment forms, configure verification uploads, and process applicant entries.</p>
          </div>
          {onCreateForm && (
            <button
              onClick={onCreateForm}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-5 text-xs font-bold shadow-sm transition-all flex-shrink-0"
            >
              <Plus className="h-4 w-4" /> Create Enrollment Form
            </button>
          )}
        </div>

        <div className="space-y-4">
          {!intakes ? (
            <p className="text-xs text-slate-400 italic">Loading active admission campaigns...</p>
          ) : intakes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <p className="text-sm text-slate-500 italic">No admission forms have been created yet.</p>
              {onCreateForm && (
                <button
                  onClick={onCreateForm}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 px-4 text-xs font-bold transition-all"
                >
                  Create your first form
                </button>
              )}
            </div>
          ) : (
            intakes.map((intake) => (
              <div
                key={intake.intakeId}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-slate-350 hover:shadow-sm transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-900 text-sm">{intake.name}</h3>
                    <select
                      value={intake.status}
                      disabled={intake.status === "draft" && !onSetIntakeStatus}
                      onChange={(event) => onSetIntakeStatus?.(intake.intakeId, event.target.value as "open" | "paused" | "closed" | "archived")}
                      className={`h-6 rounded border px-2 py-0 focus:outline-none text-[9px] font-bold uppercase tracking-wider cursor-pointer ${
                        intake.status === "open"
                          ? "bg-emerald-50 border-emerald-350 text-emerald-800"
                          : intake.status === "draft"
                            ? "bg-amber-50 border-amber-350 text-amber-800"
                            : intake.status === "paused"
                              ? "bg-amber-50 border-amber-350 text-amber-800"
                              : "bg-slate-100 border-slate-350 text-slate-800"
                      }`}
                    >
                      {intake.status === "draft" && <option value="draft">DRAFT</option>}
                      <option value="open">OPEN</option>
                      <option value="paused">PAUSED</option>
                      <option value="closed">CLOSED</option>
                      <option value="archived">ARCHIVED</option>
                    </select>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
                    <span>
                      Type: <strong className="text-slate-700">Admission Campaign</strong>
                    </span>
                    {intake.opensAt && (
                      <span>
                        Opens: <strong className="text-slate-700">{new Date(intake.opensAt).toLocaleDateString()}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {intake.status !== "draft" && schoolSlug && (
                    <button
                      onClick={() => void handleCopyApplicationLink(intake.slug)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 text-xs font-bold shadow-sm transition-all"
                      title="Copy public candidate application link"
                    >
                      <Link className="h-3.5 w-3.5" /> Copy Link
                    </button>
                  )}
                  {onEditForm && (
                    <button
                      onClick={() => onEditForm(intake.intakeId)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 text-xs font-bold shadow-sm transition-all"
                    >
                      <Settings className="h-3.5 w-3.5" /> Edit Form
                    </button>
                  )}
                  {onDeleteForm && intake.status === "draft" && (
                    <button
                      onClick={() => {
                        setIntakeToDelete({
                          id: intake.intakeId,
                          name: intake.name,
                          status: intake.status,
                        });
                        setDeleteDialogOpen(true);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 shadow-sm transition-all"
                      title="Delete draft campaign"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEnterWorkstation(intake.intakeId, intake.name)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-white px-4 text-xs font-bold shadow-sm transition-all"
                  >
                    Enter Workstation <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Campaign?"
        description={
          intakeToDelete?.status === "draft"
            ? `Are you sure you want to delete the draft campaign "${intakeToDelete?.name}"? This will permanently erase the form and all its configuration parameters.`
            : `Are you sure you want to delete the campaign "${intakeToDelete?.name}"? This will permanently delete the live form, products, pricing, and settings. This action can only be performed if no applications have been submitted.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (intakeToDelete) {
            onDeleteForm?.(intakeToDelete.id);
          }
          setDeleteDialogOpen(false);
          setIntakeToDelete(null);
        }}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setIntakeToDelete(null);
        }}
      />
    </div>
  );
}
