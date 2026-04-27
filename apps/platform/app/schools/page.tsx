"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { isConvexConfigured } from "@/convex-runtime";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SchoolsTable({
  schools,
}: {
  schools: Array<{
    _id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: number;
    adminName: string | null;
    adminEmail: string | null;
  }>;
}) {
  return (
    <div className="table-responsive hidden md:block">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-th">School</th>
            <th className="table-th">Slug</th>
            <th className="table-th">Status</th>
            <th className="table-th">Admin</th>
            <th className="table-th">Created</th>
            <th className="table-th">Actions</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => (
            <tr key={school._id} className="hover:bg-slate-50 transition-colors">
              <td className="table-td font-bold">{school.name}</td>
              <td className="table-td font-mono text-xs text-slate-500">
                {school.slug}
              </td>
              <td className="table-td">
                <span
                  className={
                    school.status === "active" ? "badge-active" : "badge-pending"
                  }
                >
                  {school.status}
                </span>
              </td>
              <td className="table-td">
                {school.adminName ? (
                  <div>
                    <div className="font-bold text-sm">{school.adminName}</div>
                    <div className="text-xs text-slate-400">
                      {school.adminEmail}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Not assigned</span>
                )}
              </td>
              <td className="table-td text-xs text-slate-500">
                {formatDate(school.createdAt)}
              </td>
              <td className="table-td">
                {school.status === "pending" && (
                  <Link
                    href={`/schools/${school._id}/assign-admin`}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Assign Admin
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchoolsCards({
  schools,
}: {
  schools: Array<{
    _id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: number;
    adminName: string | null;
    adminEmail: string | null;
  }>;
}) {
  return (
    <div className="md:hidden space-y-3">
      {schools.map((school) => (
        <div
          key={school._id}
          className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900">{school.name}</h3>
              <p className="text-xs font-mono text-slate-500">{school.slug}</p>
            </div>
            <span
              className={
                school.status === "active" ? "badge-active" : "badge-pending"
              }
            >
              {school.status}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Admin</span>
              {school.adminName ? (
                <div className="text-right">
                  <div className="font-bold">{school.adminName}</div>
                  <div className="text-xs text-slate-400">
                    {school.adminEmail}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">Not assigned</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Created</span>
              <span className="text-slate-600">
                {formatDate(school.createdAt)}
              </span>
            </div>
          </div>

          {school.status === "pending" && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Link
                href={`/schools/${school._id}/assign-admin`}
                className="block w-full text-center py-2 px-4 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                Assign Admin
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SchoolsPageChrome({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schools</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage school tenants and their administrators
          </p>
        </div>
        <Link
          href="/schools/create"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create School
        </Link>
      </div>

      {children}
    </div>
  );
}

function ConvexNotConfiguredNotice() {
  return (
    <div className="bg-white rounded-lg border border-amber-200 p-8 text-center">
      <h2 className="text-lg font-bold text-slate-900 mb-2">
        Convex Not Configured
      </h2>
      <p className="text-sm text-slate-600">
        Set <code>NEXT_PUBLIC_CONVEX_URL</code> to load platform schools.
      </p>
    </div>
  );
}

function SchoolsListPageWithConvex() {
  // Fetch schools via Convex query
  const schools = useQuery(
    "functions/platform/index:listSchools" as never,
    {} as never
  ) as
    | Array<{
        _id: string;
        name: string;
        slug: string;
        status: string;
        createdAt: number;
        adminName: string | null;
        adminEmail: string | null;
      }>
    | undefined;

  return (
    <>
      {/* Loading State */}
      {schools === undefined && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-500">Loading schools...</p>
        </div>
      )}

      {/* Empty State */}
      {schools && schools.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
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
              className="text-slate-400"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            No schools yet
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Create your first school to get started.
          </p>
          <Link
            href="/schools/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            Create School
          </Link>
        </div>
      )}

      {/* Schools List */}
      {schools && schools.length > 0 && (
        <>
          <SchoolsTable schools={schools} />
          <SchoolsCards schools={schools} />
        </>
      )}
    </>
  );
}

export default function SchoolsListPage() {
  return (
    <SchoolsPageChrome>
      {isConvexConfigured() ? (
        <SchoolsListPageWithConvex />
      ) : (
        <ConvexNotConfiguredNotice />
      )}
    </SchoolsPageChrome>
  );
}
