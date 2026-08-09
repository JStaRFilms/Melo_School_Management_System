"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { MeloLoader, appToast, getUserFacingErrorMessage } from "@school/shared";
import { AdmissionsHub } from "./AdmissionsHub";
import { AdmissionsTriage } from "./AdmissionsTriage";
import { AdmissionsFormBuilder } from "./AdmissionsFormBuilder";

type Branding = { schoolId: string; slug: string; name: string };
type CapabilityGrant = { 
  capability: string; 
  scope: string; 
  programmeId?: string | null;
  intakeId?: string | null;
};
type CapabilityProjection = { membership: { schoolId: string } | null; capabilities: CapabilityGrant[] };

export default function AdmissionsPage() {
  const branding = useQuery("functions/academic/schoolBranding:getCurrentSchoolBranding" as never, {} as never) as Branding | undefined;
  const capabilities = useQuery(
    "functions/foundation/auth:getViewerCapabilities" as never,
    branding ? { schoolId: branding.schoolId } as never : "skip" as never
  ) as CapabilityProjection | undefined;

  const deleteIntake = useMutation("functions/admissions/settings:deleteIntake" as never);
  const setIntakeStatus = useMutation("functions/admissions/settings:setIntakeStatus" as never);

  const queueIntakes = useQuery(
    "functions/admissions/staff:listAccessibleIntakes" as never,
    branding && capabilities ? { schoolId: branding.schoolId } as never : "skip" as never
  ) as Array<{ intakeId: string; name: string; status: string; slug?: string; opensAt?: number; closesAt?: number }> | undefined;

  // View state management
  const [activeView, setActiveView] = useState<"hub" | "drilldown" | "setup">("hub");
  const [selectedIntakeId, setSelectedIntakeId] = useState("");
  const [selectedIntakeName, setSelectedIntakeName] = useState("");

  const handleEnterWorkstation = (intakeId: string, name: string) => {
    setSelectedIntakeId(intakeId);
    setSelectedIntakeName(name);
    setActiveView("drilldown");
  };

  const handleCreateForm = () => {
    setSelectedIntakeId("");
    setActiveView("setup");
  };

  const handleEditForm = (intakeId: string) => {
    setSelectedIntakeId(intakeId);
    setActiveView("setup");
  };

  const handleDeleteForm = async (intakeId: string) => {
    if (!branding) return;
    try {
      await deleteIntake({ schoolId: branding.schoolId, intakeId } as never);
      appToast.success("Campaign deleted successfully!");
    } catch (err) {
      appToast.error("Failed to delete campaign", { description: getUserFacingErrorMessage(err, "An error occurred while deleting the campaign.") });
    }
  };

  const handleSetIntakeStatus = async (intakeId: string, status: "open" | "paused" | "closed" | "archived") => {
    try {
      await setIntakeStatus({ intakeId, status } as never);
      appToast.success(`Campaign status updated to ${status.toUpperCase()}!`);
    } catch (err) {
      appToast.error("Failed to update status", { description: getUserFacingErrorMessage(err, "An error occurred while updating campaign status.") });
    }
  };

  const handleBackToHub = () => {
    setActiveView("hub");
    setSelectedIntakeId("");
    setSelectedIntakeName("");
  };

  if (!branding || !capabilities) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50/50">
        <MeloLoader message="Loading admissions workspace..." />
      </div>
    );
  }

  // Capability mapping
  const can = (capability: string, scope: { intakeId?: string } = {}) => {
    return capabilities.capabilities.some((grant) => {
      if (grant.capability !== capability) return false;
      if (grant.scope === "school") return true;
      if (grant.scope === "intake") {
        return Boolean(scope.intakeId && grant.intakeId === scope.intakeId);
      }
      return false;
    });
  };

  const canManageCatalogue = can("admissions.catalogue.manage");
  const publishAllowed = can("admissions.publish");

  return (
    <main className="lg:h-screen lg:overflow-hidden bg-slate-50/50 flex flex-col">
      <div className="flex-1 flex lg:overflow-hidden">
        {activeView === "hub" && (
          <AdmissionsHub
            intakes={queueIntakes}
            schoolSlug={branding?.slug}
            onEnterWorkstation={handleEnterWorkstation}
            onCreateForm={canManageCatalogue ? handleCreateForm : undefined}
            onEditForm={canManageCatalogue ? handleEditForm : undefined}
            onDeleteForm={canManageCatalogue ? handleDeleteForm : undefined}
            onSetIntakeStatus={publishAllowed ? handleSetIntakeStatus : undefined}
          />
        )}

        {activeView === "drilldown" && (
          <AdmissionsTriage
            schoolId={branding.schoolId}
            schoolSlug={branding?.slug}
            intakeSlug={queueIntakes?.find((intake) => intake.intakeId === selectedIntakeId)?.slug}
            intakeId={selectedIntakeId}
            intakeName={selectedIntakeName}
            onBack={handleBackToHub}
            canView={can("applications.list", { intakeId: selectedIntakeId })}
            canReview={can("documents.review", { intakeId: selectedIntakeId })}
            canRecord={can("reviews.record", { intakeId: selectedIntakeId })}
            canDecide={can("decisions.record", { intakeId: selectedIntakeId })}
            canConvert={can("conversions.execute", { intakeId: selectedIntakeId })}
          />
        )}

        {activeView === "setup" && (
          <AdmissionsFormBuilder
            schoolId={branding.schoolId}
            schoolSlug={branding?.slug}
            intakeId={selectedIntakeId || undefined}
            onCancel={handleBackToHub}
            onSuccess={handleBackToHub}
            publishAllowed={publishAllowed}
          />
        )}
      </div>
    </main>
  );
}
