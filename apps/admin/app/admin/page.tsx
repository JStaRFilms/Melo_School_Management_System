"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useDeferredValue, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import {
  ArrowRightLeft,
  Crown,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { humanNameFinalStrict, humanNameTypingStrict } from "@/human-name";
import { AdminCard } from "./components/AdminCard";

type AdminRecord = {
  _id: string;
  name: string;
  email: string;
  isArchived: boolean;
  isLeadAdmin: boolean;
  managerUserId: string | null;
  managerName: string | null;
  createdAt: number;
};

type AdminDashboardData = {
  viewerUserId: string;
  leadAdmin: {
    _id: string;
    name: string;
    email: string;
  } | null;
  admins: AdminRecord[];
};

type TeacherRecord = {
  _id: string;
  name: string;
  email: string;
  createdAt: number;
};

export default function AdminManagementPage() {
  const data = useQuery(
    "functions/academic/adminLeadership:listSchoolAdmins" as never
  ) as AdminDashboardData | undefined;
  const teachers = useQuery(
    "functions/academic/academicSetup:listTeachers" as never
  ) as TeacherRecord[] | undefined;
  const createSchoolAdmin = useAction(
    "functions/academic/adminLeadership:createSchoolAdmin" as never
  );
  const promoteTeacherToAdmin = useMutation(
    "functions/academic/adminLeadership:promoteTeacherToAdmin" as never
  );
  const promoteSchoolAdmin = useMutation(
    "functions/academic/adminLeadership:promoteSchoolAdmin" as never
  );
  const archiveSchoolAdmin = useMutation(
    "functions/academic/adminLeadership:archiveSchoolAdmin" as never
  );
  const transferSchoolAdminLeadership = useMutation(
    "functions/academic/adminLeadership:transferSchoolAdminLeadership" as never
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("Admin123!Pass");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [search, setSearch] = useState("");
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const deferredSearch = useDeferredValue(search);

  const filteredAdmins = useMemo(() => {
    if (!data) {
      return [];
    }

    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return data.admins;
    }

    return data.admins.filter(
      (admin) =>
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query) ||
        (admin.managerName ?? "").toLowerCase().includes(query)
    );
  }, [data, deferredSearch]);

  const activeAdmins = data?.admins.filter((admin) => !admin.isArchived) ?? [];
  const leadAdmin = data?.leadAdmin ?? null;
  const viewerUserId = data?.viewerUserId ?? null;
  const viewerIsLead = Boolean(viewerUserId && leadAdmin && viewerUserId === leadAdmin._id);
  const viewerDirectReports =
    activeAdmins.filter((admin) => admin.managerUserId === viewerUserId).length;
  const selectedTeacher = teachers?.find((teacher) => teacher._id === selectedTeacherId) ?? null;

  const clearNotice = () => setNotice(null);

  const submitCreateAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = humanNameFinalStrict(name);
    const normalizedEmail = email.trim().toLowerCase();
    const password = temporaryPassword.trim();
    if (!normalizedName || !normalizedEmail || !password) {
      return;
    }

    setBusyAdminId("create");
    clearNotice();

    try {
      const created = (await createSchoolAdmin({
        name: normalizedName,
        email: normalizedEmail,
        temporaryPassword: password,
        origin: window.location.origin,
      } as never)) as { email: string; temporaryPassword: string };

      setName("");
      setEmail("");
      setTemporaryPassword("Admin123!Pass");
      setNotice({
        tone: "success",
        title: "Admin created",
        message: `${created.email} can sign in with the temporary password now.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Admin not created",
        message: getUserFacingErrorMessage(error, "Failed to create admin"),
      });
    } finally {
      setBusyAdminId(null);
    }
  };

  const submitPromoteTeacher = async () => {
    if (!selectedTeacherId) {
      return;
    }

    setBusyAdminId(selectedTeacherId);
    clearNotice();

    try {
      await promoteTeacherToAdmin({ teacherId: selectedTeacherId } as never);
      setSelectedTeacherId("");
      setNotice({
        tone: "success",
        title: "Teacher promoted",
        message: "The teacher row was upgraded in place to an admin.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Promotion failed",
        message: getUserFacingErrorMessage(error, "We could not promote that teacher right now."),
      });
    } finally {
      setBusyAdminId(null);
    }
  };

  const runAdminAction = async (
    adminId: string,
    action: () => Promise<unknown>,
    successMessage: string,
    failureTitle: string,
    fallbackMessage: string
  ) => {
    setBusyAdminId(adminId);
    clearNotice();

    try {
      await action();
      setNotice({
        tone: "success",
        title: successMessage,
        message: "The admin list has been refreshed.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: failureTitle,
        message: getUserFacingErrorMessage(error, fallbackMessage),
      });
    } finally {
      setBusyAdminId(null);
    }
  };

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-500 shadow-sm">
          Loading admin leadership...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              School Admins
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              Manage the admin tree, leadership, and archive rules.
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Active admins can create and re-parent other admins. The current lead admin is protected and can only be replaced by transferring leadership first.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Stat label="Total admins" value={String(data.admins.length)} icon={<ShieldAlert className="h-4 w-4" />} />
            <Stat label="Active admins" value={String(activeAdmins.length)} icon={<Sparkles className="h-4 w-4" />} />
            <Stat label="My reports" value={String(viewerDirectReports)} icon={<ArrowRightLeft className="h-4 w-4" />} />
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${notice.tone === "success" ? "text-emerald-900" : "text-amber-900"}`}>
              {notice.title}
            </p>
            <p className={`mt-1 text-sm font-medium ${notice.tone === "success" ? "text-emerald-900" : "text-amber-900"}`}>
              {notice.message}
            </p>
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          onSubmit={submitCreateAdmin}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">
                Create Admin
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                New admins are created under the signed-in admin.
              </p>
            </div>
            <UserPlus className="h-5 w-5 text-slate-400" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Admin name">
              <input
                value={name}
                onChange={(event) => setName(humanNameTypingStrict(event.target.value))}
                onBlur={(event) => setName(humanNameFinalStrict(event.target.value))}
                placeholder="Grace Okafor"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-950 outline-none focus:border-slate-400"
              />
            </Field>
            <Field label="Email address">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@school.edu"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-950 outline-none focus:border-slate-400"
              />
            </Field>
            <Field label="Temporary password">
              <input
                type="text"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-950 outline-none focus:border-slate-400"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || !temporaryPassword.trim() || busyAdminId === "create"}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.08em] text-white disabled:opacity-50"
          >
            {busyAdminId === "create" ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
            ) : (
              <Crown className="h-4 w-4 text-white/70" />
            )}
            {busyAdminId === "create" ? "Creating" : "Create admin"}
          </button>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">
                Lead Protection
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                The current lead can only change through a transfer.
              </p>
            </div>
            <ShieldAlert className="h-5 w-5 text-rose-500" />
          </div>

          {leadAdmin ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Current lead admin
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">{leadAdmin.name}</p>
              <p className="text-sm text-slate-500">{leadAdmin.email}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No lead admin record is configured yet.
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Transfer leadership only to one of the lead admin&apos;s direct sub-admins. The server will block any other target.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">
              Promote Existing Teacher
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Upgrade a teacher row directly instead of creating a duplicate admin account.
            </p>
          </div>
          <Crown className="h-5 w-5 text-slate-400" />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field label="Teacher">
            <select
              value={selectedTeacherId}
              onChange={(event) => setSelectedTeacherId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-slate-400"
            >
              <option value="">Select a teacher</option>
              {(teachers ?? []).map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.name} · {teacher.email}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            disabled={!selectedTeacherId || busyAdminId === selectedTeacherId}
            onClick={() => void submitPromoteTeacher()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black uppercase tracking-[0.08em] text-white disabled:opacity-50"
          >
            {busyAdminId === selectedTeacherId ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 text-white/70" />
            )}
            {busyAdminId === selectedTeacherId ? "Promoting" : "Promote teacher"}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {selectedTeacher ? (
            <>
              <span className="font-bold text-slate-900">{selectedTeacher.name}</span>{" "}
              will keep the same email and auth identity. We only switch the row&apos;s role from teacher to admin.
            </>
          ) : (
            "Pick an existing teacher to upgrade them in place."
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">
              Admin Directory
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Search admins, re-parent sub-admins, archive inactive people, or hand off leadership.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search admins..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-950 outline-none focus:border-slate-400"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredAdmins.map((admin) => (
            <AdminCard
              key={admin._id}
              admin={admin}
              viewerUserId={viewerUserId}
              viewerIsLead={viewerIsLead}
              leadAdminId={leadAdmin?._id ?? null}
              busyAdminId={busyAdminId}
              onPromote={() =>
                void runAdminAction(
                  admin._id,
                  () =>
                    promoteSchoolAdmin({ adminId: admin._id } as never),
                  "Admin re-parented",
                  "Promotion failed",
                  "We could not re-parent this admin right now."
                )
              }
              onArchive={() =>
                void runAdminAction(
                  admin._id,
                  () =>
                    archiveSchoolAdmin({ adminId: admin._id } as never),
                  "Admin archived",
                  "Archive failed",
                  "We could not archive this admin right now."
                )
              }
              onTransferLeadership={() =>
                void runAdminAction(
                  admin._id,
                  () =>
                    transferSchoolAdminLeadership({ adminId: admin._id } as never),
                  "Leadership transferred",
                  "Transfer failed",
                  "We could not transfer leadership right now."
                )
              }
            />
          ))}

          {filteredAdmins.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No admins match your search.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}
