"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarPlus2, CalendarRange, MapPin, PencilLine } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

type EventRecord = {
  _id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  createdAt: number;
};

function toDateTimeInputValue(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    throw new Error("Enter a valid event date and time");
  }
  return timestamp;
}

function getEventWindowLabel(event: EventRecord) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: event.isAllDay ? undefined : "short",
  }).format(new Date(event.startDate));
}

export default function EventsPage() {
  const events = useQuery(
    "functions/academic/events:listEvents" as never
  ) as EventRecord[] | undefined;
  const createEvent = useMutation(
    "functions/academic/events:createEvent" as never
  );
  const updateEvent = useMutation(
    "functions/academic/events:updateEvent" as never
  );
  const archiveEvent = useMutation(
    "functions/academic/events:archiveEvent" as never
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editIsAllDay, setEditIsAllDay] = useState(false);
  const [busyState, setBusyState] = useState<"create" | "update" | "archive" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedEvent =
    events?.find((event) => event._id === selectedEventId) ?? null;

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    setEditTitle(selectedEvent.title);
    setEditDescription(selectedEvent.description ?? "");
    setEditLocation(selectedEvent.location ?? "");
    setEditStartDate(toDateTimeInputValue(selectedEvent.startDate));
    setEditEndDate(toDateTimeInputValue(selectedEvent.endDate));
    setEditIsAllDay(selectedEvent.isAllDay);
  }, [selectedEvent]);

  const stats = useMemo(() => {
    if (!events) {
      return { total: 0, upcoming: 0 };
    }

    const now = Date.now();
    return {
      total: events.length,
      upcoming: events.filter((event) => event.endDate >= now).length,
    };
  }, [events]);

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setIsAllDay(false);
  };

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusyState("create");

    try {
      await createEvent({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        startDate: toTimestamp(startDate),
        endDate: toTimestamp(endDate),
        isAllDay,
      } as never);
      resetCreateForm();
      setNotice("Event created.");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Failed to create event"));
    } finally {
      setBusyState(null);
    }
  };

  const handleUpdateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEvent) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyState("update");

    try {
      await updateEvent({
        eventId: selectedEvent._id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        location: editLocation.trim() || null,
        startDate: toTimestamp(editStartDate),
        endDate: toTimestamp(editEndDate),
        isAllDay: editIsAllDay,
      } as never);
      setNotice("Event updated.");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Failed to update event"));
    } finally {
      setBusyState(null);
    }
  };

  const handleArchiveEvent = async () => {
    if (!selectedEvent) {
      return;
    }

    if (!window.confirm(`Archive ${selectedEvent.title}? You can restore it later from the archive page.`)) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyState("archive");

    try {
      await archiveEvent({ eventId: selectedEvent._id } as never);
      setSelectedEventId(null);
      setNotice("Event archived.");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Failed to archive event"));
    } finally {
      setBusyState(null);
    }
  };

  if (events === undefined) {
    return <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">Loading events...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-28 sm:px-6">
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={<CalendarRange className="h-4 w-4" />} label="Active events" value={String(stats.total)} helper="Live school calendar rows." />
        <StatCard icon={<CalendarPlus2 className="h-4 w-4" />} label="Upcoming" value={String(stats.upcoming)} helper="Events that have not ended yet." />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">School Events</h1>
          <p className="mt-1 text-sm text-slate-500">Create school calendar items here, archive them when they are no longer active, and restore them later from Archive Audit.</p>
        </div>

        <form onSubmit={handleCreateEvent} className="grid gap-3 lg:grid-cols-2">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" placeholder="Inter-house sports" required /></Field>
          <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" placeholder="Main field" /></Field>
          <Field label="Starts"><input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" required /></Field>
          <Field label="Ends"><input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" required /></Field>
          <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400" placeholder="Optional summary for staff and future calendar views." /></Field>
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Mark as all-day event
            </label>
            <button type="submit" disabled={busyState === "create" || !title.trim() || !startDate || !endDate} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">
              <CalendarPlus2 className="h-4 w-4 text-white/70" />
              {busyState === "create" ? "Creating..." : "Create event"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">Active calendar</h2>
          <p className="mt-1 text-xs text-slate-500">Archived events leave this list and move to Archive Audit.</p>
        </div>
        {events.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No active events yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <button key={event._id} type="button" onClick={() => setSelectedEventId(event._id)} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 ${selectedEventId === event._id ? "bg-slate-50" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{event.title}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{getEventWindowLabel(event)}{event.location ? ` · ${event.location}` : ""}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                  {event.isAllDay ? "All day" : "Timed"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedEvent ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950">Edit event</h2>
              <p className="mt-1 text-xs text-slate-500">This keeps the same event record. Use archive if you want it removed from the live calendar but still restorable later.</p>
            </div>
            <PencilLine className="h-5 w-5 text-slate-400" />
          </div>

          <form onSubmit={handleUpdateEvent} className="grid gap-3 lg:grid-cols-2">
            <Field label="Title"><input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" required /></Field>
            <Field label="Location"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-slate-400" /></div></Field>
            <Field label="Starts"><input type="datetime-local" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" required /></Field>
            <Field label="Ends"><input type="datetime-local" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" required /></Field>
            <Field label="Description"><textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400" /></Field>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={editIsAllDay} onChange={(e) => setEditIsAllDay(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                Mark as all-day event
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={busyState === "update"} className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">{busyState === "update" ? "Saving..." : "Save event"}</button>
                <button type="button" onClick={() => void handleArchiveEvent()} disabled={busyState === "archive"} className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 disabled:opacity-50">{busyState === "archive" ? "Archiving..." : "Archive event"}</button>
              </div>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
