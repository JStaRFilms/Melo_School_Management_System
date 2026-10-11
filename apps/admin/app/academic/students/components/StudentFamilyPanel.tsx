"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getUserFacingErrorMessage } from "@school/shared";
import { normalizeStructuredPersonName } from "@school/shared/name-format";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { AdmissionContactFields } from "./AdmissionContactFields";
import { admissionParentGuardian, emptyAdmissionContact } from "./admissionContact";
import { PortalCredentialPanel } from "./PortalCredentialPanel";
import { PortalStateLabel } from "./PortalStateLabel";
import { RelationshipField } from "./RelationshipField";
import type { EnrollmentNotice } from "./types";

type Parent = FunctionReturnType<typeof api.functions.academic.studentEnrollment.getStudentFamilyProfile>["parents"][number];
type ContactEdit = {
  parent: Parent; structured: boolean; fullName: string; firstName: string; middleName: string; lastName: string;
  email: string; phone: string; relationship: string; isPrimaryContact: boolean; confirmPrimaryChange: boolean;
  addressMode: "residential" | "different" | "legacy"; addressOverride: string;
};
const inputClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900";

export function StudentFamilyPanel({ studentId, studentName, onNotice }: { studentId: string; studentName: string; onNotice: (notice: EnrollmentNotice) => void }) {
  const profile = useQuery(api.functions.academic.studentEnrollment.getStudentFamilyProfile, { studentId: studentId as Id<"students"> });
  const link = useMutation(api.functions.academic.studentEnrollment.upsertStudentFamilyLink);
  const editContact = useMutation(api.functions.academic.studentEnrollment.updateStudentFamilyParentContact);
  const editHousehold = useMutation(api.functions.academic.studentEnrollment.updateHousehold);
  const removeLink = useMutation(api.functions.academic.studentEnrollment.removeStudentFamilyLink);
  const unlinkStudent = useMutation(api.functions.academic.studentEnrollment.unlinkStudentFromFamily);
  const deleteParent = useMutation(api.functions.academic.studentEnrollment.deleteUnusedParent);
  const [contact, setContact] = useState(emptyAdmissionContact);
  const selectedReview = useQuery(api.functions.academic.studentEnrollment.getParentEmailReview, contact.contactChoice === "existing" && contact.parentEmail ? { email: contact.parentEmail } : "skip");
  const [edit, setEdit] = useState<ContactEdit | null>(null);
  const [household, setHousehold] = useState<{ name: string; residentialAddress: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<"link" | "edit" | "household" | "unlinkStudent" | null>(null);
  const [remove, setRemove] = useState<Parent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: Id<"users">; name: string } | null>(null);
  const [lastUnlinked, setLastUnlinked] = useState<{ id: Id<"users">; name: string } | null>(null);
  useEffect(() => { setContact(emptyAdmissionContact); setEdit(null); setHousehold(null); setReview(null); setLastUnlinked(null); setDeleteTarget(null); }, [studentId]);
  const errorNotice = (error: unknown) => onNotice({ tone: "error", message: getUserFacingErrorMessage(error, "The change could not be completed.") });
  const submitLink = async (confirmed = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const choice = admissionParentGuardian(contact);
      if (choice.kind === "none") throw new Error("Choose or create a contact first.");
      const { kind, ...args } = choice;
      await link({ studentId: studentId as Id<"students">, ...args, confirmDuplicateLink: confirmed });
      setContact(emptyAdmissionContact); setReview(null);
      onNotice({ tone: "success", message: `Contact linked to ${studentName}. Stored identity and credentials were not reset.` });
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "Contact linking failed.");
      if (message.includes("Review the duplicate-link details and confirm")) setReview("link");
      else errorNotice(error);
    } finally { setBusy(false); }
  };
  const saveEdit = async (confirmDuplicateEmail = false) => {
    if (!edit || busy) return;
    setBusy(true);
    try {
      const old = edit.parent;
      const name = normalizeStructuredPersonName(edit);
      if (edit.structured && (!name.firstName || !name.lastName)) throw new Error("First and last name are required when entering name parts.");
      const nameChanged = edit.structured !== Boolean(old.firstName && old.lastName) || edit.firstName !== (old.firstName ?? "") || edit.middleName !== (old.middleName ?? "") || edit.lastName !== (old.lastName ?? "");
      await editContact({
        familyMemberId: old._id,
        ...(edit.structured ? (nameChanged ? { firstName: name.firstName, middleName: name.middleName || null, lastName: name.lastName } : {}) : edit.fullName !== old.name || old.firstName ? { name: edit.fullName } : {}),
        email: edit.email !== old.email ? edit.email : undefined,
        phone: edit.phone !== (old.phone ?? "") ? edit.phone || null : undefined,
        relationship: edit.relationship !== (old.relationship ?? "") ? edit.relationship || null : undefined,
        isPrimaryContact: edit.isPrimaryContact !== old.isPrimaryContact ? edit.isPrimaryContact : undefined,
        confirmPrimaryChange: edit.confirmPrimaryChange, confirmDuplicateEmail,
        addressMode: edit.addressMode !== (old.addressMode ?? "legacy") && edit.addressMode !== "legacy" ? edit.addressMode : undefined,
        addressOverride: edit.addressOverride !== (old.addressOverride ?? "") ? edit.addressOverride || null : undefined,
      });
      setEdit(null); setReview(null); onNotice({ tone: "success", message: "Contact details saved. Household label and credentials are unchanged." });
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "Contact edit failed.");
      if (message.includes("confirm") && message.toLowerCase().includes("email")) setReview("edit"); else errorNotice(error);
    } finally { setBusy(false); }
  };
  const saveHousehold = async () => {
    if (!household || !profile?.family || busy) return;
    setBusy(true);
    try { await editHousehold({ familyId: profile.family._id, name: household.name, residentialAddress: household.residentialAddress || null, confirmed: true }); setHousehold(null); setReview(null); }
    catch (error) { errorNotice(error); } finally { setBusy(false); }
  };
  const confirmRemove = async () => {
    if (!remove || busy) return;
    setBusy(true);
    try {
      await removeLink({ familyMemberId: remove._id });
      if (remove.role === "parent") setLastUnlinked({ id: remove.parentUserId, name: remove.name });
      setRemove(null); onNotice({ tone: "success", message: "Contact unlinked. The identity and credentials remain." });
    } catch (error) { errorNotice(error); } finally { setBusy(false); }
  };
  const confirmDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try { await deleteParent({ parentUserId: deleteTarget.id, confirmed: true }); setDeleteTarget(null); setLastUnlinked(null); setContact(emptyAdmissionContact); onNotice({ tone: "success", message: "Unused school-local parent deleted. Shared identity and authentication records were preserved." }); }
    catch (error) { errorNotice(error); } finally { setBusy(false); }
  };
  if (!profile) return <p role="status">Loading household...</p>;
  return <section className="space-y-5">
    <h3 className="text-sm font-bold">Parents and guardians</h3>
    {profile.family ? <div className="space-y-2 text-xs">
      <p>Household label: <strong>{profile.family.name}</strong></p>
      <p>Residential address: {profile.family.residentialAddress || "Not recorded"}</p>
      <p>{profile.family.studentCount} linked students · {profile.family.parentCount} contacts</p>
      <button type="button" onClick={() => setHousehold({ name: profile.family?.name ?? "", residentialAddress: profile.family?.residentialAddress ?? "" })}>Edit household label and address</button>
      <button type="button" className="ml-3" onClick={() => setReview("unlinkStudent")}>Unlink student from household</button>
    </div> : <p className="text-xs text-slate-500">No household linked yet.</p>}
    {household && <form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); setReview("household"); }}>
      <label className="block text-xs">Household label<input required className={inputClass} value={household.name} onChange={event => setHousehold({ ...household, name: event.target.value })} /></label>
      <label className="block text-xs">Household residential address<input className={inputClass} value={household.residentialAddress} onChange={event => setHousehold({ ...household, residentialAddress: event.target.value })} /></label>
      <button type="submit">Review household change</button><button type="button" className="ml-3" onClick={() => setHousehold(null)}>Cancel household edit</button>
    </form>}
    {profile.parents.map(parent => <article key={parent._id} className="space-y-3 border-t border-slate-200 pt-4 text-xs">
      <p className="font-bold">{parent.name} · {parent.relationship || "Relationship unspecified"}{parent.isPrimaryContact ? " · Primary contact" : ""}</p>
      <p className="break-words">{parent.email}{parent.phone ? ` · ${parent.phone}` : ""}</p>
      <p>Contact address: {parent.effectiveAddress || "Not recorded"} · {parent.addressSource}</p>
      <PortalStateLabel state={parent.portalState} />
      {parent.role === "parent" ? <button type="button" onClick={() => setEdit({ parent, structured: Boolean(parent.firstName && parent.lastName), fullName: parent.name, firstName: parent.firstName ?? "", middleName: parent.middleName ?? "", lastName: parent.lastName ?? "", email: parent.email, phone: parent.phone ?? "", relationship: parent.relationship ?? "", isPrimaryContact: parent.isPrimaryContact, confirmPrimaryChange: false, addressMode: parent.addressMode ?? "legacy", addressOverride: parent.addressOverride ?? "" })}>Edit contact</button> : <p>Staff identity is read-only here. Use staff management to edit it.</p>}
      <button type="button" className="ml-3" onClick={() => setRemove(parent)}>Unlink contact</button>
      {edit?.parent._id === parent._id && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void saveEdit(); }}>
        {edit.structured ? <><p>Recorded name: {edit.fullName}</p><div className="grid gap-3 sm:grid-cols-3">{([['firstName', 'First name'], ['middleName', 'Middle name (optional)'], ['lastName', 'Last name']] as const).map(([key, label]) => <label key={key}>{label}<input required={key !== "middleName"} className={inputClass} value={edit[key]} onChange={event => setEdit({ ...edit, [key]: event.target.value })} onBlur={() => { const name = normalizeStructuredPersonName(edit); setEdit({ ...edit, firstName: name.firstName ?? "", middleName: name.middleName ?? "", lastName: name.lastName ?? "" }); }} /></label>)}</div><button type="button" onClick={() => setEdit({ ...edit, structured: false, fullName: parent.name })}>Use full name</button></> : <label className="block">Full name<input required className={inputClass} value={edit.fullName} onChange={event => setEdit({ ...edit, fullName: event.target.value })} /><button type="button" onClick={() => setEdit({ ...edit, structured: true })}>Enter name parts</button></label>}
        <label className="block">Email<input type="email" required className={inputClass} value={edit.email} onChange={event => setEdit({ ...edit, email: event.target.value })} /></label>
        <label className="block">Phone<input type="tel" className={inputClass} value={edit.phone} onChange={event => setEdit({ ...edit, phone: event.target.value })} /></label>
        <RelationshipField value={edit.relationship} onChange={relationship => setEdit({ ...edit, relationship })} />
        <label className="block">Contact address source<select className={inputClass} value={edit.addressMode} onChange={event => setEdit({ ...edit, addressMode: event.target.value === "different" ? "different" : event.target.value === "residential" ? "residential" : "legacy" })}><option value="residential">Same residential address</option><option value="different">Different address</option><option value="legacy">Retain recorded address</option></select></label>
        {edit.addressMode === "different" && <label className="block">Different address<input required className={inputClass} value={edit.addressOverride} onChange={event => setEdit({ ...edit, addressOverride: event.target.value })} /></label>}
        <label className="flex gap-2"><input type="checkbox" checked={edit.isPrimaryContact} onChange={event => setEdit({ ...edit, isPrimaryContact: event.target.checked, confirmPrimaryChange: false })} />Primary household contact</label>
        {edit.isPrimaryContact && !parent.isPrimaryContact && profile.parents.some(item => item.isPrimaryContact) && <label className="flex gap-2"><input type="checkbox" required checked={edit.confirmPrimaryChange} onChange={event => setEdit({ ...edit, confirmPrimaryChange: event.target.checked })} />I confirm changing the primary contact for all linked students.</label>}
        <button disabled={busy} type="submit">Save contact</button><button type="button" className="ml-3" onClick={() => setEdit(null)}>Cancel contact edit</button>
      </form>}
      {parent.role === "parent" && <PortalCredentialPanel key={parent.parentUserId} title={`Portal access for ${parent.name}`} userId={parent.parentUserId} userName={parent.name} email={parent.email} defaultPassword="" onNotice={onNotice} />}
    </article>)}
    <form onSubmit={event => { event.preventDefault(); void submitLink(); }} className="space-y-3">
      <AdmissionContactFields value={contact} onChange={setContact} />
      <button type="submit" disabled={busy || contact.contactChoice === "none"}>Link contact</button>
      {selectedReview?.matches.some(match => match.userId === contact.selectedContactId && match.role === "parent" && !match.isArchived) && <button type="button" className="ml-3" onClick={() => setDeleteTarget({ id: contact.selectedContactId as Id<"users">, name: selectedReview.matches.find(match => match.userId === contact.selectedContactId)?.name ?? contact.parentEmail })}>Delete selected parent if unused</button>}
    </form>
    {lastUnlinked && <div className="space-y-2 text-xs"><p>Unlinked contact: {lastUnlinked.name}. Unlinking did not delete this identity.</p><button type="button" onClick={() => setDeleteTarget(lastUnlinked)}>Delete if genuinely unused</button></div>}
    <ConfirmationModal isOpen={review !== null} onClose={() => setReview(null)} onConfirm={() => {
      if (review === "link") void submitLink(true);
      else if (review === "edit") void saveEdit(true);
      else if (review === "household") void saveHousehold();
      else if (review === "unlinkStudent") { setBusy(true); void unlinkStudent({ studentId: studentId as Id<"students"> }).then(() => setReview(null)).catch(errorNotice).finally(() => setBusy(false)); }
    }} title={review === "household" ? "Confirm household change" : review === "unlinkStudent" ? "Unlink student?" : "Confirm contact review"} description={review === "household" ? "The label and residential address change for this household. All inheriting students and contacts use the new address. Different-address overrides and identities remain unchanged." : review === "unlinkStudent" ? "Remove this student's household link. No parent identity or credentials will be deleted." : "Review the matching identity and household before continuing. Linking keeps stored identity read-only. An explicit email edit may link to another account; confirm only if it is the intended contact."} confirmLabel="Confirm" isLoading={busy} />
    <ConfirmationModal isOpen={remove !== null} onClose={() => setRemove(null)} onConfirm={() => void confirmRemove()} title="Unlink contact?" description={`Remove ${remove?.name ?? "this contact"} from the household? This is not identity deletion and does not reset access.`} confirmLabel="Unlink contact" isLoading={busy} />
    <ConfirmationModal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} title="Permanently delete unused parent?" description={`Delete the school-local record for ${deleteTarget?.name ?? "this parent"} only if the backend proves it is unused. Remaining student links, archived records, retained references or review limits block deletion. Shared authentication and other-school identities remain.`} confirmLabel="Delete unused parent" confirmVariant="danger" isLoading={busy} />
  </section>;
}
