"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../packages/convex/_generated/api";
import type { Id } from "../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { getErrorMessage } from "@school/shared/toast";

const groups = api.functions.academic.groups;
const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600";
const button =
  "rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";

export default function GroupsPage() {
  const auth = useAuth();
  if (!isConvexConfigured())
    return (
      <p className="p-6">
        Group governance requires a configured development backend.
      </p>
    );
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Checking platform access…
      </p>
    );
  if (!auth.isPlatformAdmin)
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Permission denied</h1>
        <p>Active Platform authority is required.</p>
        <Link href="/schools">Return to schools</Link>
      </main>
    );
  return <GroupWorkbench />;
}

function GroupWorkbench() {
  const directory = usePaginatedQuery(
    groups.listGroups,
    {},
    { initialNumItems: 25 },
  );
  const schools = usePaginatedQuery(
    groups.listLinkableSchools,
    {},
    { initialNumItems: 25 },
  );
  const [groupId, setGroupId] = useState<Id<"schoolGroups">>();
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  const [ownerId, setOwnerId] = useState<Id<"persons">>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const candidates = useQuery(
    groups.listProprietorCandidates,
    schoolId && !groupId ? { schoolId } : "skip",
  );
  const overview = useQuery(
    groups.getGroupOverview,
    groupId ? { groupId } : "skip",
  );
  const create = useMutation(groups.createSchoolGroup);
  const link = useMutation(groups.linkBranchToGroup);
  const selectedSchool = schools.results.find((s) => s.schoolId === schoolId);
  const selectedOwner = candidates?.find((p) => p.personId === ownerId);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/schools" className="underline">
          Schools
        </Link>
        <span aria-current="page">Groups</span>
        <Link href="/audit" className="underline">
          Audit
        </Link>
      </nav>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Platform governance
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          School groups
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Link independent branches under reviewed ownership. Students,
          invoices, assignments and permissions stay in their original school.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Group directory</h2>
          {directory.status === "LoadingFirstPage" && (
            <p role="status" className="py-4">
              Loading groups…
            </p>
          )}
          {directory.status !== "LoadingFirstPage" &&
            !directory.results.length && (
              <p className="py-4 text-sm text-slate-600">
                No groups yet. Create one with an explicitly reviewed
                proprietor.
              </p>
            )}
          <ul className="mt-3 divide-y divide-slate-200">
            {directory.results.map((g) => (
              <li key={g._id} className="py-3">
                <button
                  disabled={g.status !== "active" || pending}
                  onClick={() => {
                    setGroupId(g._id);
                    setConfirmation("");
                    setMessage("");
                  }}
                  className="w-full text-left disabled:opacity-50"
                >
                  <span className="font-semibold">{g.name}</span>
                  <span className="block break-all text-xs text-slate-500">
                    {g.slug} · {g.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {directory.status === "CanLoadMore" && (
            <button
              className="mt-3 underline"
              onClick={() => directory.loadMore(25)}
            >
              Load more groups
            </button>
          )}
          {groupId && (
            <div className="mt-5 border-t pt-4">
              <h3 className="font-semibold">Linked branches</h3>
              {!overview ? (
                <p role="status">Loading overview…</p>
              ) : (
                <>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    Owner: {overview.group.proprietorPersonId}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {overview.branches.map((b) => (
                      <li key={b.schoolId} className="text-sm">
                        {b.name}{" "}
                        {b.isHeadquarters && (
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                            HQ
                          </span>
                        )}
                        <span className="block text-xs text-slate-500">
                          {b.status} · metadata only
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending || !schoolId) return;
            setPending(true);
            setMessage("");
            setFailed(false);
            try {
              if (groupId) await link({ groupId, schoolId, confirmation });
              else {
                if (!ownerId) return;
                const result = await create({
                  name,
                  slug,
                  headquartersSchoolId: schoolId,
                  proprietorPersonId: ownerId,
                  confirmation,
                });
                setGroupId(result.groupId);
              }
              setMessage(
                "Saved. Group metadata updated; operational tenant records were not moved.",
              );
              setConfirmation("");
              setSchoolId(undefined);
            } catch (error) {
              setFailed(true);
              setMessage(getErrorMessage(error));
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {groupId ? "Link a branch" : "Create a group"}
            </h2>
            {groupId && (
              <button
                type="button"
                disabled={pending}
                className="text-sm underline"
                onClick={() => {
                  setGroupId(undefined);
                  setConfirmation("");
                }}
              >
                New group instead
              </button>
            )}
          </div>
          <fieldset disabled={pending} className="space-y-4">
            {!groupId && (
              <>
                <label className="block text-sm font-medium">
                  Group name
                  <input
                    required
                    maxLength={120}
                    className={input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Group slug
                  <input
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={80}
                    className={input}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </label>
              </>
            )}
            <label className="block text-sm font-medium">
              {groupId ? "Target branch" : "Headquarters branch"}
              <select
                required
                className={input}
                value={schoolId ?? ""}
                onChange={(e) => {
                  setSchoolId(
                    schools.results.find((s) => s.schoolId === e.target.value)
                      ?.schoolId,
                  );
                  setOwnerId(undefined);
                  setConfirmation("");
                }}
              >
                <option value="">Select an active, unlinked school</option>
                {schools.results.map((s) => (
                  <option
                    key={s.schoolId}
                    value={s.schoolId}
                    disabled={s.status !== "active" || s.linked}
                  >
                    {s.name} ({s.slug})
                    {s.linked ? " — linked" : ` — ${s.status}`}
                  </option>
                ))}
              </select>
            </label>
            {schools.status === "CanLoadMore" && (
              <button
                type="button"
                className="text-sm underline"
                onClick={() => schools.loadMore(25)}
              >
                Load more schools
              </button>
            )}
            {!groupId && schoolId && (
              <label className="block text-sm font-medium">
                Reviewed intended proprietor
                <select
                  required
                  className={input}
                  value={ownerId ?? ""}
                  onChange={(e) =>
                    setOwnerId(
                      candidates?.find((p) => p.personId === e.target.value)
                        ?.personId,
                    )
                  }
                >
                  <option value="">
                    {candidates === undefined
                      ? "Loading canonical members…"
                      : "Select a canonical headquarters member"}
                  </option>
                  {candidates?.map((p) => (
                    <option key={p.personId} value={p.personId}>
                      {p.name} · {p.personId}
                    </option>
                  ))}
                </select>
                {candidates?.length === 0 && (
                  <span className="mt-2 block text-sm text-slate-600">
                    No eligible canonical members. Reviewed identity setup is
                    required; no owner will be inferred.
                  </span>
                )}
              </label>
            )}
            {selectedSchool && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p>
                  <strong>Review:</strong>{" "}
                  {groupId
                    ? `Link ${selectedSchool.name} to ${overview?.group.name ?? "selected group"}`
                    : `Create ${name || "new group"} with HQ ${selectedSchool.name} and owner ${selectedOwner?.name ?? "not selected"}`}
                  . This grants statutory group ownership, not branch
                  memberships.
                </p>
                <label className="block font-medium">
                  Type branch slug “{selectedSchool.slug}” to confirm
                  <input
                    required
                    autoComplete="off"
                    className={input}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              </div>
            )}
          </fieldset>
          {message && (
            <p
              role={failed ? "alert" : "status"}
              className="break-words text-sm"
            >
              {message}
            </p>
          )}
          <button
            className={button}
            disabled={
              pending ||
              !selectedSchool ||
              confirmation !== selectedSchool.slug ||
              (!groupId && !ownerId)
            }
          >
            {pending
              ? "Saving…"
              : groupId
                ? "Confirm branch link"
                : "Confirm group creation"}
          </button>
        </form>
      </div>
      <aside className="border-t border-slate-200 pt-4 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">
          Ownership recovery is separately gated
        </h2>
        <p className="mt-1">
          Recovery and headquarters replacement require verified support
          evidence and intended canonical ownership. This workbench does not
          perform recovery, migration or automatic membership creation.
        </p>
      </aside>
    </main>
  );
}
