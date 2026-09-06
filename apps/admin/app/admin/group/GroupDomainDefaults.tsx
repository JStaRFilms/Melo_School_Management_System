"use client";

import Link from "next/link";
import { Component, useState, type ReactNode } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";

const endpoints = api.functions.academic.groups;
type Domain = FunctionArgs<typeof endpoints.getGroupDomainSetting>["domain"];
type Setting = FunctionArgs<typeof endpoints.saveGroupDomainSetting>["setting"];
type Change = FunctionArgs<typeof endpoints.saveBranchDomainSetting>["change"];
type GroupData = FunctionReturnType<typeof endpoints.getGroupDomainSetting>;
type BranchData = FunctionReturnType<typeof endpoints.getBranchDomainSetting>;

const DOMAINS: Array<{ id: Domain; label: string; note: string }> = [
  { id: "role_templates", label: "Role templates", note: "Controls which immutable templates are offered for future explicit assignment. It never assigns a role." },
  { id: "report_card_template", label: "Report cards", note: "Prospective report defaults only. Certified reports retain their issued snapshot." },
  { id: "notification_preferences", label: "Notifications", note: "Controls in-app Portal academic updates only. It does not send email or SMS or broaden audit recipients." },
  { id: "academic_policy", label: "Academic policy", note: "Controls the effective exam input mode used by current assessment/report consumers." },
  { id: "calendar_template", label: "Calendar template", note: "Applied only when a branch creates a session with automatic terms. Existing branch dates are never merged or rewritten." },
];

function initialSetting(domain: Domain, value?: Setting["value"]): Setting {
  const candidate = value as Setting["value"] | undefined;
  switch (domain) {
    case "role_templates":
      return { domain, value: "templateIds" in (candidate ?? {}) ? candidate as Extract<Setting, { domain: "role_templates" }>["value"] : { templateIds: [] } };
    case "report_card_template":
      return { domain, value: "resultCalculationMode" in (candidate ?? {}) ? candidate as Extract<Setting, { domain: "report_card_template" }>["value"] : { resultCalculationMode: "standalone", defaultTimesSchoolOpened: null } };
    case "notification_preferences":
      return { domain, value: "showReportUpdates" in (candidate ?? {}) ? candidate as Extract<Setting, { domain: "notification_preferences" }>["value"] : { showReportUpdates: true, showTeacherComments: true, showUpcomingEvents: true } };
    case "academic_policy":
      return { domain, value: "examInputMode" in (candidate ?? {}) ? candidate as Extract<Setting, { domain: "academic_policy" }>["value"] : { examInputMode: "raw40" } };
    case "calendar_template":
      return { domain, value: "terms" in (candidate ?? {}) ? candidate as Extract<Setting, { domain: "calendar_template" }>["value"] : { terms: [
        { name: "First Term", startOffsetDays: 0, endOffsetDays: 90, resultCalculationMode: "standalone" },
        { name: "Second Term", startOffsetDays: 105, endOffsetDays: 195, resultCalculationMode: "standalone" },
        { name: "Third Term", startOffsetDays: 210, endOffsetDays: 300, resultCalculationMode: "standalone" },
      ] } };
  }
}

export default function GroupDomainDefaults({
  groupId,
  branches,
  branchOnly = false,
  initialSchoolId,
}: {
  groupId: Id<"schoolGroups">;
  branches: Array<{ schoolId: Id<"schools">; name: string }>;
  branchOnly?: boolean;
  initialSchoolId?: Id<"schools">;
}) {
  const [domain, setDomain] = useState<Domain>("role_templates");
  const [schoolId, setSchoolId] = useState<Id<"schools"> | undefined>(initialSchoolId);
  const memberships = useQuery(endpoints.listUserBranches, {});
  const permitted = branches.filter((branch) =>
    memberships?.some((membership) => membership.schoolId === branch.schoolId),
  );
  const group = useQuery(
    endpoints.getGroupDomainSetting,
    branchOnly ? "skip" : { groupId, domain },
  );
  const selected = DOMAINS.find((item) => item.id === domain)!;

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Shared operational defaults</h2>
        <p className="mt-1 text-sm text-slate-600">
          One versioned inheritance workflow for domain-owned settings. Linking a branch never opts it in.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="text-sm font-medium">
          Settings domain
          <select className="mt-1 w-full rounded border p-2" value={domain} onChange={(event) => setDomain(event.target.value as Domain)}>
            {DOMAINS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Authorized branch override
          <select className="mt-1 w-full rounded border p-2" value={schoolId ?? ""} onChange={(event) => setSchoolId(permitted.find((item) => item.schoolId === event.target.value)?.schoolId)}>
            <option value="">Select a branch</option>
            {permitted.map((branchItem) => <option key={branchItem.schoolId} value={branchItem.schoolId}>{branchItem.name}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-600">{selected.note}</p>
      {!branchOnly && (!group ? <p role="status">Loading {selected.label.toLowerCase()} default…</p> : (
        <GroupEditor key={`${domain}:${group.version}`} data={group} />
      ))}
      {memberships && permitted.length === 0 && (
        <p className="text-sm text-slate-600">No explicitly authorized branch is available for overrides. Group ownership alone does not grant branch access.</p>
      )}
      {schoolId && (
        <DomainBranchBoundary key={`${schoolId}:${domain}`}>
          <BranchDomainEditor groupId={groupId} schoolId={schoolId} domain={domain} />
        </DomainBranchBoundary>
      )}
      <div className="border-t pt-4 text-sm">
        <h3 className="font-medium">Admission formats</h3>
        <p className="mt-1 text-slate-600">
          The existing numbering editor owns format publication and explicit inherit/override/reset. Counters and claims always remain branch-owned.
        </p>
        <Link className="mt-2 inline-block underline" href="/admin/settings/admission-numbering">Open admission numbering</Link>
      </div>
    </section>
  );
}

function GroupEditor({ data }: { data: GroupData }) {
  const convex = useConvex();
  const save = useMutation(endpoints.saveGroupDomainSetting);
  const [setting, setSetting] = useState<Setting>(() => initialSetting(data.domain, data.defaults?.value));
  const [allowBranchOverride, setAllowBranchOverride] = useState(data.defaults?.allowBranchOverride ?? true);
  const [expectedVersion, setExpectedVersion] = useState(data.version);
  const [reviewing, setReviewing] = useState(false);
  const [previewWarning, setPreviewWarning] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      <p>Group source · current version {data.version} · editing version {expectedVersion}</p>
      {data.version !== expectedVersion && <p role="alert">A newer version exists. Your draft is retained; discard it to load the latest.</p>}
      <TypedFields setting={setting} setSetting={setSetting} roleCandidates={data.roleCandidates} disabled={pending || reviewing} />
      {setting.domain === "role_templates" && (
        <GroupRoleTemplateCreator data={data} />
      )}
      <label className="flex gap-2"><input type="checkbox" checked={allowBranchOverride} disabled={pending || reviewing} onChange={(event) => setAllowBranchOverride(event.target.checked)} />Allow explicit branch override</label>
      {!reviewing ? <button className="rounded border px-3 py-2" disabled={pending} onClick={async () => {
        setPending(true); setMessage("");
        try {
          const preview = await convex.query(endpoints.previewGroupDomainSetting, {
            groupId: data.groupId,
            expectedVersion,
            allowBranchOverride,
            setting,
          });
          setPreviewWarning(preview.warning); setReviewing(true);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed; retry"); }
        finally { setPending(false); }
      }}>Review default</button> : (
        <div className="space-y-2 border-t pt-3">
          <p>{previewWarning}</p>
          <label className="block">Confirm group slug: {data.slug}<input className="mt-1 w-full rounded border p-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <div className="flex gap-3">
            <button className="rounded border px-3 py-2" disabled={pending || confirmation !== data.slug} onClick={async () => {
              setPending(true); setMessage("");
              try {
                const version = await save({ groupId: data.groupId, expectedVersion, allowBranchOverride, confirmation, setting });
                setExpectedVersion(version); setReviewing(false); setPreviewWarning(""); setConfirmation(""); setMessage("Group default saved");
              } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed; retry"); }
              finally { setPending(false); }
            }}>Confirm default</button>
            <button className="underline" disabled={pending} onClick={() => { setReviewing(false); setPreviewWarning(""); setConfirmation(""); }}>Back to edit</button>
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}

class DomainBranchBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div role="alert" className="space-y-2 text-sm">
        <p>Branch setting access is denied or unavailable. Explicit membership and the domain capability are required.</p>
        <button className="underline" onClick={() => this.setState({ failed: false })}>Retry branch access</button>
      </div>
    ) : this.props.children;
  }
}

function BranchDomainEditor({ groupId, schoolId, domain }: { groupId: Id<"schoolGroups">; schoolId: Id<"schools">; domain: Domain }) {
  const data = useQuery(endpoints.getBranchDomainSetting, { groupId, schoolId, domain });
  return data ? (
    <BranchEditor key={`${data.groupVersion}:${data.revision}`} groupId={groupId} schoolId={schoolId} data={data} />
  ) : <p role="status">Loading branch origin…</p>;
}

function BranchEditor({ groupId, schoolId, data }: { groupId: Id<"schoolGroups">; schoolId: Id<"schools">; data: BranchData }) {
  const save = useMutation(endpoints.saveBranchDomainSetting);
  const [mode, setMode] = useState<"inherit" | "override">(data.mode === "override" ? "override" : "inherit");
  const [setting, setSetting] = useState<Setting>(() =>
    data.domain === "role_templates"
      ? initialSetting(data.domain, { templateIds: [] })
      : initialSetting(data.domain, data.value ?? undefined),
  );
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const change: Change = mode === "inherit"
    ? { domain: data.domain, mode: "inherit" } as Change
    : { ...setting, mode: "override" } as Change;
  return (
    <div className="space-y-3 rounded-lg border border-slate-300 p-4 text-sm">
      <p>Effective origin: {data.source} · mode {data.mode} · group version {data.groupVersion} · branch revision {data.revision}</p>
      <fieldset className="flex flex-wrap gap-4" disabled={pending}>
        <label><input type="radio" checked={mode === "inherit"} onChange={() => setMode("inherit")} /> Inherit / reset to group</label>
        <label><input type="radio" checked={mode === "override"} disabled={!data.allowBranchOverride} onChange={() => setMode("override")} /> Explicit branch override</label>
      </fieldset>
      {mode === "override" && <TypedFields setting={setting} setSetting={setSetting} roleCandidates={data.roleCandidates} disabled={pending} />}
      <label className="block">Confirm branch slug: {data.slug}<input className="mt-1 w-full rounded border p-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <button className="rounded border px-3 py-2" disabled={pending || confirmation !== data.slug} onClick={async () => {
        setPending(true); setMessage("");
        try {
          await save({ groupId, schoolId, expectedGroupVersion: data.groupVersion, expectedRevision: data.revision, confirmation, change });
          setConfirmation(""); setMessage(mode === "inherit" ? "Branch reset to group default" : "Branch override saved");
        } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed; retry"); }
        finally { setPending(false); }
      }}>Confirm branch choice</button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

function GroupRoleTemplateCreator({ data }: { data: GroupData }) {
  const create = useMutation(endpoints.createGroupRoleTemplateVersion);
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer font-medium">Create immutable group role template</summary>
      <div className="mt-3 space-y-3">
        <label className="block">Template name<input className="mt-1 w-full rounded border p-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <fieldset className="max-h-56 space-y-1 overflow-auto rounded border p-2">
          <legend className="px-1">Capabilities</legend>
          {data.capabilityCatalog.map((capability) => <label key={capability} className="flex gap-2"><input type="checkbox" checked={capabilities.includes(capability)} onChange={(event) => setCapabilities(event.target.checked ? [...capabilities, capability] : capabilities.filter((item) => item !== capability))} />{capability}</label>)}
        </fieldset>
        <label className="block">Confirm group slug to create without assigning: {data.slug}<input className="mt-1 w-full rounded border p-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button className="rounded border px-3 py-2" disabled={!name.trim() || confirmation !== data.slug} onClick={async () => {
          setMessage("");
          try {
            await create({ groupId: data.groupId, name, capabilities, confirmation });
            setName(""); setCapabilities([]); setConfirmation(""); setMessage("Role template version created; no role assigned");
          } catch (error) { setMessage(error instanceof Error ? error.message : "Create failed; retry"); }
        }}>Create template version</button>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}

function TypedFields({ setting, setSetting, roleCandidates, disabled }: { setting: Setting; setSetting: (value: Setting) => void; roleCandidates: GroupData["roleCandidates"]; disabled: boolean }) {
  switch (setting.domain) {
    case "role_templates":
      return <fieldset disabled={disabled} className="space-y-2"><legend className="font-medium">Available immutable templates</legend>{roleCandidates.length === 0 ? <p className="text-slate-500">No group-scoped role template versions are available. Create templates in Permissions; no assignments are made here.</p> : roleCandidates.map((candidate) => <label key={candidate.id} className="flex gap-2"><input type="checkbox" checked={setting.value.templateIds.includes(candidate.id)} onChange={(event) => setSetting({ domain: setting.domain, value: { templateIds: event.target.checked ? [...setting.value.templateIds, candidate.id] : setting.value.templateIds.filter((id) => id !== candidate.id) } })} />{candidate.name}</label>)}</fieldset>;
    case "report_card_template":
      return <div className="grid gap-2 sm:grid-cols-2"><label>Calculation mode<select disabled={disabled} className="mt-1 w-full rounded border p-2" value={setting.value.resultCalculationMode} onChange={(event) => setSetting({ domain: setting.domain, value: { ...setting.value, resultCalculationMode: event.target.value as "standalone" | "cumulative_annual" } })}><option value="standalone">Standalone term</option><option value="cumulative_annual">Cumulative annual</option></select></label><label>Default days opened<input disabled={disabled} className="mt-1 w-full rounded border p-2" type="number" min={0} max={366} value={setting.value.defaultTimesSchoolOpened ?? ""} onChange={(event) => setSetting({ domain: setting.domain, value: { ...setting.value, defaultTimesSchoolOpened: event.target.value === "" ? null : Number(event.target.value) } })} /></label></div>;
    case "notification_preferences":
      return <fieldset disabled={disabled} className="space-y-2"><legend className="font-medium">Portal in-app updates</legend>{(["showReportUpdates", "showTeacherComments", "showUpcomingEvents"] as const).map((key) => <label key={key} className="flex gap-2"><input type="checkbox" checked={setting.value[key]} onChange={(event) => setSetting({ domain: setting.domain, value: { ...setting.value, [key]: event.target.checked } })} />{{ showReportUpdates: "Report updates", showTeacherComments: "Teacher comments", showUpcomingEvents: "Upcoming calendar events" }[key]}</label>)}</fieldset>;
    case "academic_policy":
      return <label className="block">Exam input mode<select disabled={disabled} className="mt-1 w-full rounded border p-2" value={setting.value.examInputMode} onChange={(event) => setSetting({ domain: setting.domain, value: { examInputMode: event.target.value as "raw40" | "raw60_scaled_to_40" } })}><option value="raw40">Raw / 40</option><option value="raw60_scaled_to_40">Raw / 60, scaled to 40</option></select></label>;
    case "calendar_template":
      return <fieldset disabled={disabled} className="space-y-3"><legend className="font-medium">Relative term dates (days after session start)</legend>{setting.value.terms.map((term, index) => <div key={index} className="grid gap-2 sm:grid-cols-3"><label>Term name<input className="mt-1 w-full rounded border p-2" value={term.name} onChange={(event) => setSetting({ domain: setting.domain, value: { terms: setting.value.terms.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) } })} /></label><label>Start offset<input className="mt-1 w-full rounded border p-2" type="number" min={0} value={term.startOffsetDays} onChange={(event) => setSetting({ domain: setting.domain, value: { terms: setting.value.terms.map((item, itemIndex) => itemIndex === index ? { ...item, startOffsetDays: Number(event.target.value) } : item) } })} /></label><label>End offset<input className="mt-1 w-full rounded border p-2" type="number" min={0} value={term.endOffsetDays} onChange={(event) => setSetting({ domain: setting.domain, value: { terms: setting.value.terms.map((item, itemIndex) => itemIndex === index ? { ...item, endOffsetDays: Number(event.target.value) } : item) } })} /></label></div>)}</fieldset>;
  }
}
