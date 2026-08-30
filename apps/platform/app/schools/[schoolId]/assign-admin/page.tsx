"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { isConvexConfigured } from "@/convex-runtime";
import { appToast, getErrorMessage } from "@school/shared/toast";
import { ResetSchoolAdminPasswordModal } from "../../ResetSchoolAdminPasswordModal";
import { ManageFeaturesModal, type SchoolFeatureSet } from "../../ManageFeaturesModal";

function AssignAdminForm() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.schoolId as string;

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch school details
  const schools = useQuery(
    api.functions.platform.index.listSchools,
    {}
  ) as
    | Array<{
        _id: string;
        name: string;
        slug: string;
        status: string;
        adminName: string | null;
        adminEmail: string | null;
        features: SchoolFeatureSet;
      }>
    | undefined;

  const school = schools?.find((s) => s._id === schoolId);

  const provisionAdmin = useAction(
    api.functions.platform.index.provisionSchoolAdmin
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = adminName.trim();
    const trimmedEmail = adminEmail.trim().toLowerCase();

    if (!trimmedName) {
      appToast.warning("Review required before assigning", {
        id: "platform-assign-admin-error",
        description: "Admin name is required.",
      });
      return;
    }

    if (!trimmedEmail) {
      appToast.warning("Review required before assigning", {
        id: "platform-assign-admin-error",
        description: "Admin email is required.",
      });
      return;
    }

    if (!adminPassword || adminPassword.length < 8) {
      appToast.warning("Review required before assigning", {
        id: "platform-assign-admin-error",
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await provisionAdmin({
        schoolId,
        adminName: trimmedName,
        adminEmail: trimmedEmail,
        adminPassword,
        origin: window.location.origin,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/schools");
      }, 2000);
    } catch (error) {
      appToast.error("Unable to assign admin", {
        id: "platform-assign-admin-error",
        description: getErrorMessage(error, "Failed to assign school admin."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (schools === undefined) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-500">Loading school details...</p>
        </div>
      </div>
    );
  }

  // School not found
  if (!school) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            School Not Found
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            The requested school could not be found.
          </p>
          <button
            onClick={() => router.push("/schools")}
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            Back to Schools
          </button>
        </div>
      </div>
    );
  }

  const [showResetModal, setShowResetModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);

  // Already has admin
  if (school.status === "active" && !success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push("/schools")}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
          >
            &larr; Back to Schools
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-600"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1 text-center">
            Active School Administrator
          </h2>
          <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Admin</div>
            <div className="font-bold text-slate-900">{school.adminName}</div>
            <div className="text-xs font-mono text-slate-500">{school.adminEmail}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="py-2.5 px-3 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors shadow-xs"
            >
              Reset Admin Password
            </button>
            <button
              type="button"
              onClick={() => setShowFeaturesModal(true)}
              className="py-2.5 px-3 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-xs"
            >
              Manage Modules
            </button>
          </div>

          <button
            onClick={() => router.push("/schools")}
            className="w-full mt-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Return to Schools Overview
          </button>
        </div>

        <ResetSchoolAdminPasswordModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          school={school}
        />

        <ManageFeaturesModal
          isOpen={showFeaturesModal}
          onClose={() => setShowFeaturesModal(false)}
          school={school}
        />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-green-600"
            >
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            Admin Assigned
          </h2>
          <p className="text-sm text-slate-500">
            {adminName} can now sign in to the admin app for{" "}
            <strong>{school.name}</strong>.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Redirecting to schools list...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/schools")}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
        >
          &larr; Back to Schools
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">
            Assign School Admin
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create an admin account for <strong>{school.name}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Admin Name */}
          <div>
            <label
              htmlFor="adminName"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Admin Name *
            </label>
            <input
              id="adminName"
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="e.g. John Doe"
              className="editor-input"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Admin Email */}
          <div>
            <label
              htmlFor="adminEmail"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Admin Email *
            </label>
            <input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="e.g. admin@greenfield.edu"
              className="editor-input"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1">
              This email will be used for sign-in. Must be unique across the
              system.
            </p>
          </div>

          {/* Temporary Password */}
          <div>
            <label
              htmlFor="adminPassword"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Temporary Password *
            </label>
            <input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="editor-input font-mono"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1">
              Share this password with the school admin securely. They can
              change it after first sign-in.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Provisioning..." : "Assign Admin"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/schools")}
              disabled={isSubmitting}
              className="py-2.5 px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssignAdminPage() {
  const isConfigured = isConvexConfigured();

  useEffect(() => {
    if (!isConfigured) {
      appToast.error("Unable to assign admin", {
        id: "platform-assign-admin-error",
        description: "Convex is not configured. Cannot assign admin.",
      });
    }
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border border-amber-200 p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Convex Not Configured
          </h2>
          <p className="text-sm text-slate-600">
            Set <code>NEXT_PUBLIC_CONVEX_URL</code> to assign school admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-500">Loading...</p>
          </div>
        </div>
      }
    >
      <AssignAdminForm />
    </Suspense>
  );
}
