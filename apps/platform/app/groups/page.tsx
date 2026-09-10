"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../packages/convex/_generated/api";
import type { Id } from "../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { getErrorMessage } from "@school/shared/toast";
import GroupBranchAccess from "./GroupBranchAccess";
import {
  Building2,
  CheckCircle2,
  Layers,
  Plus,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Link2,
  Info,
  ChevronRight,
  School,
  ExternalLink,
  Sparkles,
} from "lucide-react";

const groups = api.functions.academic.groups;

export default function GroupsPage() {
  const auth = useAuth();

  if (!isConvexConfigured()) {
    return (
      <div className="p-8 text-center text-slate-600">
        School Group management requires a configured backend.
      </div>
    );
  }

  if (auth.isLoading) {
    return (
      <div className="py-12 text-center text-slate-500 text-sm">
        Loading group workspace…
      </div>
    );
  }

  if (!auth.isPlatformAdmin) {
    return (
      <main className="p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Permission Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          Super Admin platform authority is required to manage school groups.
        </p>
        <Link
          href="/schools"
          className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline"
        >
          Return to Schools
        </Link>
      </main>
    );
  }

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
    { initialNumItems: 50 },
  );

  const [groupId, setGroupId] = useState<Id<"schoolGroups">>();
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  const [ownerUserId, setOwnerUserId] = useState<Id<"users">>();
  const [ownerId, setOwnerId] = useState<Id<"persons">>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isLinkingBranch, setIsLinkingBranch] = useState(false);
  const [branchToLinkId, setBranchToLinkId] = useState<Id<"schools">>();
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
  const reconcileAdminIdentity = useAction(
    api.functions.platform.index.reconcileSchoolAdminIdentity,
  );

  // Auto-slug generation from Group Name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  // Auto-select the administrator when the school has only one.
  useEffect(() => {
    if (!candidates) return;
    if (candidates.length === 1 && !ownerUserId) {
      setOwnerUserId(candidates[0].userId);
      setOwnerId(candidates[0].personId);
      return;
    }
    const selected = candidates.find(
      (candidate) => candidate.userId === ownerUserId,
    );
    if (selected?.personId && selected.personId !== ownerId) {
      setOwnerId(selected.personId);
    }
  }, [candidates, ownerId, ownerUserId]);

  const selectedHeadquartersSchool = schools.results.find((s) => s.schoolId === schoolId);
  const selectedBranchToLink = schools.results.find((s) => s.schoolId === branchToLinkId);

  const availableUnlinkedSchools = schools.results.filter(
    (s) => s.status === "active" && !s.linked,
  );

  const totalGroups = directory.results.length;
  const totalSchools = schools.results.length;
  const linkedSchoolsCount = schools.results.filter((s) => s.linked).length;

  // Handle Group Creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !schoolId || !ownerId || !selectedHeadquartersSchool) return;

    setPending(true);
    setMessage("");
    setFailed(false);

    try {
      const result = await create({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        headquartersSchoolId: schoolId,
        proprietorPersonId: ownerId,
        confirmation: selectedHeadquartersSchool.slug,
      });

      setGroupId(result.groupId);
      setMessage(`Successfully created group "${name}".`);
      setName("");
      setSlug("");
      setSlugManuallyEdited(false);
      setSchoolId(undefined);
      setOwnerUserId(undefined);
      setOwnerId(undefined);
    } catch (error) {
      setFailed(true);
      setMessage(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  // Handle Branch Linking
  const handleLinkBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !groupId || !branchToLinkId || !selectedBranchToLink) return;

    setPending(true);
    setMessage("");
    setFailed(false);

    try {
      await link({
        groupId,
        schoolId: branchToLinkId,
        confirmation: selectedBranchToLink.slug,
      });

      setMessage(`Linked "${selectedBranchToLink.name}" to the group.`);
      setBranchToLinkId(undefined);
      setIsLinkingBranch(false);
    } catch (error) {
      setFailed(true);
      setMessage(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-School Network</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            School Groups
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Unite independent campus locations under a shared leadership umbrella.
            Each school retains its students and records, while groups enable organization-wide management.
          </p>
        </div>

        {groupId && (
          <button
            type="button"
            onClick={() => {
              setGroupId(undefined);
              setMessage("");
              setFailed(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Group
          </button>
        )}
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Groups</div>
            <div className="text-lg font-bold text-slate-900">{totalGroups}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Grouped Campuses</div>
            <div className="text-lg font-bold text-slate-900">
              {linkedSchoolsCount} <span className="text-xs font-normal text-slate-400">of {totalSchools} schools</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold">
            <School className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Available to Link</div>
            <div className="text-lg font-bold text-slate-900">{availableUnlinkedSchools.length}</div>
          </div>
        </div>
      </div>

      {/* Global Status Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-3 ${
            failed
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {failed ? (
            <Info className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left Column: Groups Directory */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-fit">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Groups Directory
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {directory.results.length}
            </span>
          </div>

          <div className="p-3 divide-y divide-slate-100">
            {directory.status === "LoadingFirstPage" ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Loading groups…
              </div>
            ) : directory.results.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-700">No Groups Found</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Create your first school group to begin linking campuses.
                </div>
              </div>
            ) : (
              directory.results.map((g) => {
                const isSelected = groupId === g._id;
                return (
                  <button
                    key={g._id}
                    type="button"
                    onClick={() => {
                      setGroupId(g._id);
                      setIsLinkingBranch(false);
                      setMessage("");
                      setFailed(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all my-1 flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-50/80 border border-indigo-200 shadow-xs"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{g.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {g.slug}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? "text-indigo-600 translate-x-0.5" : "text-slate-300"
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>

          {directory.status === "CanLoadMore" && (
            <div className="p-3 border-t border-slate-100 text-center">
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:underline"
                onClick={() => directory.loadMore(25)}
              >
                Load More Groups
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Group Inspector or Group Creation */}
        <div>
          {groupId ? (
            /* Selected Group Details & Management */
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900">
                        {overview?.group.name ?? "Loading..."}
                      </h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-1">
                      slug: {overview?.group.slug}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLinkingBranch(!isLinkingBranch)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs self-start"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {isLinkingBranch ? "Close Branch Picker" : "Link Another Branch"}
                  </button>
                </div>

                {/* Inline Branch Linking Drawer */}
                {isLinkingBranch && (
                  <form
                    onSubmit={handleLinkBranch}
                    className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Add a Branch Campus to this Group
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Choose an active school that is not yet part of any group.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select School
                      </label>
                      <select
                        required
                        value={branchToLinkId ?? ""}
                        onChange={(e) =>
                          setBranchToLinkId(
                            schools.results.find((s) => s.schoolId === e.target.value)?.schoolId,
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                      >
                        <option value="">Choose an available school…</option>
                        {availableUnlinkedSchools.map((s) => (
                          <option key={s.schoolId} value={s.schoolId}>
                            {s.name} ({s.slug})
                          </option>
                        ))}
                      </select>
                      {availableUnlinkedSchools.length === 0 && (
                        <p className="text-[11px] text-amber-600 mt-1 font-medium">
                          All existing schools are currently linked to a group. Create a new school in the Schools tab first.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={pending || !branchToLinkId}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
                      >
                        {pending ? "Linking Campus…" : "Confirm & Link Branch"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLinkingBranch(false)}
                        className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Linked Branches Table */}
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Campuses in this Group
                  </h3>

                  {!overview ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Loading campus overview…
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Campus Name</th>
                            <th className="px-4 py-3">Slug</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {overview.branches.map((b) => (
                            <tr key={b.schoolId} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <School className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{b.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500">{b.slug}</td>
                              <td className="px-4 py-3">
                                {b.isHeadquarters ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                    Headquarters
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                    Branch Campus
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              {overview && (
                <GroupBranchAccess
                  key={`access:${groupId}`}
                  groupId={groupId}
                  groupSlug={overview.group.slug}
                  branches={overview.branches}
                />
              )}
            </div>
          ) : (
            /* Group Creation Form */
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="pb-5 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Create a New School Group
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Start by giving your group a name, selecting the main Headquarters school, and designating an administrator as the Group Proprietor.
                </p>
              </div>

              {/* Intuitive How-It-Works Box */}
              <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
                <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">How Multi-School Groups Work</div>
                  <div>
                    1. <strong>Campuses are created first</strong> in the Schools tab.
                  </div>
                  <div>
                    2. Choose one campus as the <strong>Headquarters (HQ)</strong> for this group.
                  </div>
                  <div>
                    3. After creation, you can link as many additional branch campuses as needed.
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Group Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Olive Blessed Education Group"
                      className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Group Slug (URL Identifier) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      maxLength={80}
                      value={slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setSlug(e.target.value);
                      }}
                      placeholder="e.g. olive-blessed-group"
                      className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Headquarters Campus <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={schoolId ?? ""}
                    onChange={(e) => {
                      const sel = schools.results.find((s) => s.schoolId === e.target.value);
                      setSchoolId(sel?.schoolId);
                      setOwnerUserId(undefined);
                      setOwnerId(undefined);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  >
                    <option value="">Select an active school to serve as Headquarters…</option>
                    {availableUnlinkedSchools.map((s) => (
                      <option key={s.schoolId} value={s.schoolId}>
                        {s.name} ({s.slug})
                      </option>
                    ))}
                  </select>
                  {availableUnlinkedSchools.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1 font-medium">
                      No unlinked active schools available. Please create a school first.
                    </p>
                  )}
                </div>

                {schoolId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Group Proprietor <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={ownerUserId ?? ""}
                      onChange={(e) => {
                        const selected = candidates?.find(
                          (candidate) => candidate.userId === e.target.value,
                        );
                        setOwnerUserId(selected?.userId);
                        setOwnerId(selected?.personId);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                    >
                      <option value="">
                        {candidates === undefined
                          ? "Loading eligible administrators…"
                          : "Choose an administrator from this school…"}
                      </option>
                      {candidates?.map((candidate) => (
                        <option key={candidate.userId} value={candidate.userId}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>

                    {candidates && candidates.length === 0 && (
                      <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <span className="font-bold">No administrator assigned yet: </span>
                        This school does not have an active administrator. Please visit{" "}
                        <Link
                          href={`/schools/${schoolId}/assign-admin`}
                          className="font-bold underline text-amber-900"
                        >
                          Assign Administrator
                        </Link>{" "}
                        first.
                      </div>
                    )}

                    {ownerUserId && !ownerId && (
                      <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <p>
                          <span className="font-bold">Administrator found. </span>
                          Confirm this existing account before using it as the
                          group proprietor.
                        </p>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={async () => {
                            if (!schoolId || !ownerUserId || pending) return;
                            setPending(true);
                            setMessage("");
                            setFailed(false);
                            try {
                              const result = await reconcileAdminIdentity({
                                schoolId,
                                userId: ownerUserId,
                              });
                              setOwnerId(result.personId);
                              setMessage(
                                "Administrator confirmed and ready for group ownership.",
                              );
                            } catch (error) {
                              setFailed(true);
                              setMessage(getErrorMessage(error));
                            } finally {
                              setPending(false);
                            }
                          }}
                          className="rounded-lg bg-amber-900 px-3 py-2 font-bold text-white disabled:opacity-50"
                        >
                          {pending ? "Confirming…" : "Confirm Administrator"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {selectedHeadquartersSchool && ownerId && (
                  <div className="p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-950 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      Ready to establish <strong>{name || "Group"}</strong> with{" "}
                      <strong>{selectedHeadquartersSchool.name}</strong> as Headquarters.
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pending || !name || !slug || !schoolId || !ownerId}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2"
                  >
                    {pending ? "Creating Group…" : "Create School Group"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
