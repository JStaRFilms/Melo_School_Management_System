"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarRange, Sparkles, Search, PlusCircle, X } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { EventCard } from "./components/EventCard";
import { EventCreationForm } from "./components/EventCreationForm";
import { EventEditForm } from "./components/EventEditForm";

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

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    throw new Error("Enter a valid event date and time");
  }
  return timestamp;
}

export default function EventsPage() {
  const events = useQuery(
    "functions/academic/events:listEvents" as never
  ) as EventRecord[] | undefined;
  
  const createEvent = useMutation("functions/academic/events:createEvent" as never);
  const updateEvent = useMutation("functions/academic/events:updateEvent" as never);
  const archiveEvent = useMutation("functions/academic/events:archiveEvent" as never);

  const [search, setSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [busyState, setBusyState] = useState<"create" | "update" | "archive" | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const deferredSearch = useDeferredValue(search);
  
  const selectedEvent = useMemo(() => 
    events?.find((e) => e._id === selectedEventId) ?? null,
  [events, selectedEventId]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const query = deferredSearch.trim().toLowerCase();
    
    let result = events;
    if (query) {
      result = result.filter(
        (e) => 
          e.title.toLowerCase().includes(query) || 
          e.location?.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort by start date (upcoming first)
    return [...result].sort((a, b) => a.startDate - b.startDate);
  }, [deferredSearch, events]);

  const stats = useMemo(() => {
    if (!events) return { total: 0, upcoming: 0 };
    const now = Date.now();
    return {
      total: events.length,
      upcoming: events.filter((e) => e.endDate >= now).length,
    };
  }, [events]);

  const handleCreate = async (data: {
    title: string;
    location: string | null;
    startDate: string;
    endDate: string;
    description: string | null;
    isAllDay: boolean;
  }) => {
    setBusyState("create");
    setNotice(null);
    try {
      await createEvent({
        ...data,
        startDate: toTimestamp(data.startDate),
        endDate: toTimestamp(data.endDate),
      } as never);
      setNotice({ tone: "success", title: "Event Created", message: `${data.title} added to calendar.` });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Creation Failed",
        message: getUserFacingErrorMessage(err, "Failed to schedule event.")
      });
    } finally {
      setBusyState(null);
    }
  };

  const handleUpdate = async (id: string, data: {
    title: string;
    location: string | null;
    startDate: string;
    endDate: string;
    description: string | null;
    isAllDay: boolean;
  }) => {
    setBusyState("update");
    setNotice(null);
    try {
      await updateEvent({
        eventId: id,
        ...data,
        startDate: toTimestamp(data.startDate),
        endDate: toTimestamp(data.endDate),
      } as never);
      setNotice({ tone: "success", title: "Record Updated", message: "Event changes saved successfully." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to save changes.")
      });
    } finally {
      setBusyState(null);
    }
  };

  const handleArchive = async (id: string) => {
    const event = events?.find(e => e._id === id);
    if (!event) return;
    if (!window.confirm(`Archive ${event.title}? It will be moved to Archive Audit.`)) return;

    setBusyState("archive");
    setNotice(null);
    try {
      await archiveEvent({ eventId: id } as never);
      if (selectedEventId === id) setSelectedEventId(null);
      setNotice({ tone: "success", title: "Event Archived", message: "Removed from live calendar." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Archive Failed",
        message: getUserFacingErrorMessage(err, "Failed to deactivate record.")
      });
    } finally {
      setBusyState(null);
    }
  };

  if (events === undefined) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-10 md:px-8">
        <div className="animate-pulse space-y-10">
          <div className="h-10 w-48 rounded-lg bg-slate-100" />
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-10 h-96 rounded-xl bg-slate-50" />
            <div className="h-96 rounded-xl bg-slate-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />
      
      <div className="relative mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:space-y-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start lg:justify-between">
          <aside className="w-full lg:w-[340px] lg:shrink-0 space-y-6 lg:sticky lg:top-8 h-fit">
            {selectedEvent ? (
              <EventEditForm
                event={selectedEvent}
                onUpdate={handleUpdate}
                onArchive={handleArchive}
                onClose={() => setSelectedEventId(null)}
                isSaving={busyState === "update"}
                isArchiving={busyState === "archive"}
              />
            ) : (
              <EventCreationForm
                onProvision={handleCreate}
                isSubmitting={busyState === "create"}
              />
            )}
            
            <div className="pt-4 border-t border-slate-200/60">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Calendar Policy</h4>
              <p className="mt-1.5 text-xs leading-relaxed font-medium text-slate-400">
                School events are visible to all staff. Past events are automatically moved to history but can be archived for audit compliance.
              </p>
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-6 md:space-y-8">
            <AdminHeader
              title="School Calendar"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Total Events",
                      value: stats.total,
                      icon: <CalendarRange className="h-4 w-4" />,
                    },
                    {
                      label: "Upcoming",
                      value: stats.upcoming,
                      icon: <Sparkles className="h-4 w-4" />,
                    },
                  ]}
                />
              }
            />

            {notice && (
              <div className={`group relative overflow-hidden rounded-lg border-l-4 p-4 shadow-lg transition-all border-white bg-white ${
                notice.tone === "success" ? "border-l-emerald-500" : "border-l-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {notice.title}
                    </p>
                    <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotice(null)}
                    className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">Active Schedule</h3>
                <p className="text-xs font-medium text-slate-500">
                  Manage upcoming academic and extracurricular activities.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find event..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event._id}
                  event={event}
                  isSelected={selectedEventId === event._id}
                  onSelect={() => setSelectedEventId(event._id)}
                  onArchive={() => handleArchive(event._id)}
                />
              ))}

              {filteredEvents.length === 0 && (
                <div className="sm:col-span-2 xl:col-span-3 py-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
                  <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <p className="mt-6 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">No Events Found</p>
                  <p className="mt-2 text-sm font-medium text-slate-400 max-w-[200px]">Refine your search or schedule a new event in the sidebar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
