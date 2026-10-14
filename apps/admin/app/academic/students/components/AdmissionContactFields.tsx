"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { cleanEmailInput, cleanPhoneInput } from "@school/shared";
import { normalizeStructuredPersonName } from "@school/shared/name-format";
import type { AdmissionContact } from "./admissionContact";
import { RelationshipField } from "@school/shared";
import { QueryErrorBoundary } from "./QueryErrorBoundary";
import { PortalStateLabel } from "./PortalStateLabel";

const inputClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900";

type ContactFieldsProps = { value: AdmissionContact; onChange: (value: AdmissionContact) => void };

export function AdmissionContactFields(props: ContactFieldsProps) {
  return <QueryErrorBoundary key={props.value.contactChoice} message="Could not load contacts or check portal access."><AdmissionContactFieldsContent {...props} /></QueryErrorBoundary>;
}

function AdmissionContactFieldsContent({ value, onChange }: ContactFieldsProps) {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<"name" | "email">("name");
  const [cursor, setCursor] = useState<string | null>(null);
  const contacts = useQuery(api.functions.academic.studentEnrollment.searchParentContacts,
    value.contactChoice === "existing" && !value.selectedContactId ? { search, searchField, paginationOpts: { numItems: 20, cursor } } : "skip");
  const review = useQuery(api.functions.academic.studentEnrollment.getParentEmailReview,
    value.contactChoice !== "none" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.parentEmail) ? { email: value.parentEmail } : "skip");
  const selected = review?.matches.find(match => match.userId === value.selectedContactId && !match.isArchived && match.role !== "student");
  const household = selected?.families[0];
  const state = useQuery(api.functions.academic.studentEnrollment.getPortalAccountState, selected ? { userId: selected.userId } : "skip");
  const patch = (changes: Partial<AdmissionContact>) => onChange({ ...value, ...changes });
  const choose = (userId: string, email: string) => patch({ contactChoice: "existing", selectedContactId: userId, parentEmail: email, isParentPrimaryContact: false, confirmPrimaryChange: false });
  return <section className="space-y-4 border-t border-slate-200 pt-4">
    <h3 className="text-sm font-bold text-slate-900">Parents and guardians</h3>
    <label className="block text-xs font-semibold text-slate-600">Contact choice
      <select className={inputClass} value={value.contactChoice} onChange={event => {
        const contactChoice = event.target.value;
        if (contactChoice === "none" || contactChoice === "existing" || contactChoice === "new") patch({ contactChoice, selectedContactId: "", confirmPrimaryChange: false });
      }}>
        <option value="none">Add later</option><option value="existing">Choose existing contact</option><option value="new">Create new contact</option>
      </select>
    </label>
    {value.contactChoice === "existing" && !value.selectedContactId && <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-600">Search field
        <select className={inputClass} value={searchField} onChange={event => { setSearchField(event.target.value === "email" ? "email" : "name"); setCursor(null); }}>
          <option value="name">Name</option><option value="email">Email</option>
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-600">Search contacts by {searchField}
        <input className={inputClass} maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setCursor(null); }} />
      </label>
      <p className="text-xs text-slate-600">Matches word prefixes, not text inside a word.</p>
      {contacts === undefined ? <p role="status">Loading contacts...</p> : <>
        {!contacts.page.length && <p>{contacts.isDone ? "No matching contacts." : "No matching contacts on this page."}</p>}
        {contacts.page.map(contact => <button type="button" key={contact.userId} onClick={() => choose(contact.userId, contact.email)} className="block w-full break-words rounded-lg border border-slate-200 p-3 text-left text-xs">
          <span className="block font-semibold">{contact.displayName}</span><span className="block">{contact.email}{contact.phone ? ` · ${contact.phone}` : ""}</span>
          <span className="block">{contact.households.map(family => family.name).join(", ") || "No household"}</span><PortalStateLabel state={contact.portalState} />
        </button>)}
        {!contacts.isDone && <button type="button" onClick={() => setCursor(contacts.continueCursor)}>Next contact page</button>}
      </>}
    </div>}
    {value.contactChoice === "existing" && value.selectedContactId && <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
      {review === undefined ? <p role="status">Checking selected contact...</p> : !selected ? <p role="alert">This contact is no longer available. Change contact before submitting.</p> : <>
        <p className="font-bold">{selected.name}</p><p className="break-words">{selected.email}{selected.phone ? ` · ${selected.phone}` : ""}</p><PortalStateLabel state={state?.state} />
        <p>Linking this contact will not change their details or reset their credentials.</p>
        <p>Household label: {household?.name ?? "A new household will be created"}</p>
        {household && <><p>Residential address: {household.residentialAddress || "Not recorded"}. Linking another child will not replace it.</p><p>Primary contact: {household.primaryContact?.name ?? "Not selected"}</p><p>Contact address: {household.contactAddress || "Not recorded"} · {household.contactAddressSource}</p></>}
      </>}
      <button type="button" onClick={() => patch({ selectedContactId: "", confirmPrimaryChange: false })}>Change contact</button>
    </div>}
    {value.contactChoice === "new" && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([['parentFirstName', 'Contact first name'], ['parentMiddleName', 'Contact middle name (optional)'], ['parentLastName', 'Contact last name']] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-600">{label}
          <input className={inputClass} value={value[key]} required={key !== "parentMiddleName"} onChange={event => patch({ [key]: event.target.value })} onBlur={() => {
            const name = normalizeStructuredPersonName({ firstName: value.parentFirstName, middleName: value.parentMiddleName, lastName: value.parentLastName });
            patch({ parentFirstName: name.firstName ?? "", parentMiddleName: name.middleName ?? "", parentLastName: name.lastName ?? "" });
          }} />
        </label>)}
      </div>
      <label className="block text-xs font-semibold text-slate-600">Contact email<input className={inputClass} type="email" required value={value.parentEmail} onChange={event => patch({ parentEmail: cleanEmailInput(event.target.value) })} /></label>
      <label className="block text-xs font-semibold text-slate-600">Contact phone (optional)<input className={inputClass} type="tel" value={value.parentPhone} onChange={event => patch({ parentPhone: cleanPhoneInput(event.target.value) })} /></label>
      {review?.matches.map(match => <div key={match.userId} className="space-y-1 text-xs">
        <p>{match.name} · {match.email} · {match.families.map(family => family.name).join(", ")}</p>
        {match.isArchived || match.role === "student" ? <p role="alert">This account cannot be linked as a contact.</p> : <button type="button" onClick={() => choose(match.userId, match.email)}>Use stored contact, keep their details</button>}
      </div>)}
      <label className="block text-xs font-semibold text-slate-600">Contact address
        <select className={inputClass} value={value.parentAddressMode} onChange={event => patch({ parentAddressMode: event.target.value === "different" ? "different" : "residential" })}><option value="residential">Same residential address</option><option value="different">Different address</option></select>
      </label>
      {value.parentAddressMode === "different" && <label className="block text-xs font-semibold text-slate-600">Different contact address<input required className={inputClass} value={value.parentAddressOverride} onChange={event => patch({ parentAddressOverride: event.target.value })} /></label>}
    </>}
    {value.contactChoice !== "none" && <>
      <RelationshipField value={value.parentRelationship} onChange={parentRelationship => patch({ parentRelationship })} />
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={value.isParentPrimaryContact} onChange={event => patch({ isParentPrimaryContact: event.target.checked, confirmPrimaryChange: false })} />Use this contact as the household primary contact</label>
      {value.isParentPrimaryContact && household?.primaryContact && household.primaryContact.userId !== value.selectedContactId && <label className="flex gap-2 text-xs"><input required type="checkbox" checked={value.confirmPrimaryChange} onChange={event => patch({ confirmPrimaryChange: event.target.checked })} />I confirm replacing {household.primaryContact.name} as primary contact for all students in this household.</label>}
    </>}
  </section>;
}
