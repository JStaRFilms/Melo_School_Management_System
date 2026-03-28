"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { isConvexConfigured } from "@/convex-runtime";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function CreateSchoolForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createSchool = useMutation(
    "functions/platform/index:createSchool" as never
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setName(newName);
      if (!isSlugManuallyEdited) {
        setSlug(slugify(newName));
      }
    },
    [isSlugManuallyEdited]
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsSlugManuallyEdited(true);
      setSlug(slugify(e.target.value));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (!trimmedName) {
      setError("School name is required");
      return;
    }

    if (!trimmedSlug) {
      setError("School slug is required");
      return;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setError(
        "Slug must be lowercase alphanumeric with hyphens (e.g. my-school)"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isConvexConfigured()) {
        setError("Convex is not configured. Cannot create school.");
        return;
      }

      await createSchool({ name: trimmedName, slug: trimmedSlug } as never);
      setSuccess(true);
      setTimeout(() => {
        router.push("/schools");
      }, 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create school";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            School Created
          </h2>
          <p className="text-sm text-slate-500">
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
          <h1 className="text-xl font-bold text-slate-900">Create School</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add a new school tenant to the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* School Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              School Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Greenfield Academy"
              className="editor-input"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* School Slug */}
          <div>
            <label
              htmlFor="slug"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              School Slug *
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={handleSlugChange}
              placeholder="e.g. greenfield-academy"
              className="editor-input font-mono"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1">
              Unique URL identifier. Lowercase, alphanumeric, hyphens only.
              Immutable after creation.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-slate-900 text-white rounded-md text-sm font-bold hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create School"}
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

export default function CreateSchoolPage() {
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
      <CreateSchoolForm />
    </Suspense>
  );
}
