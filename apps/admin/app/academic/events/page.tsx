"use client";

import { useDeferredValue, useMemo, useRef, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarRange, Sparkles, Search, PlusCircle, X } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EventCard } from "./components/EventCard";
import { EventCreationForm } from "./components/EventCreationForm";
import { EventEditForm } from "./components/EventEditForm";
import { useIsMobile } from "@/hooks/useIsMobile";

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

function toTimestamp(value: string, isEnd = false, isAllDay = false) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    const timestamp = new Date(
      year,
      month - 1,
      day,
      isAllDay && isEnd ? 23 : 0,
      isAllDay && isEnd ? 59 : 0,
      0,
      0
    ).getTime();
    return timestamp;
  }

  const timestamp = new Date(normalized).getTime();
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
  const isMobile = useIsMobile();
  const [busyState, setBusyState] = useState<"create" | "update" | "archive" | null>(null);

  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const archiveResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<EventRecord | null>(null);

  const deferredSearch = useDeferredValue(search);
  
  const selectedEvent = useMemo(() => 
    events?.find((e) => e._id === selectedEventId) ?? null,
  [events, selectedEventId]);

  // Handle auto-scroll to selected card on mobile
  useEffect(() => {
    if (selectedEventId && isMobile) {
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(`event-${selectedEventId}`);
        if (element) {
          const yOffset = -120; // Positions the card comfortably above the sheet
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [isMobile, selectedEventId]);

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
        startDate: toTimestamp(data.startDate, false, data.isAllDay),
        endDate: toTimestamp(data.endDate, true, data.isAllDay),
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
        startDate: toTimestamp(data.startDate, false, data.isAllDay),
        endDate: toTimestamp(data.endDate, true, data.isAllDay),
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

    const confirmed = await new Promise<boolean>((resolve) => {
      archiveResolverRef.current = resolve;
      setArchiveTarget(event);
    });
    archiveResolverRef.current = null;
    setArchiveTarget(null);
    if (!confirmed) return;

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
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title={archiveTarget ? `Archive ${archiveTarget.title}?` : "Archive event?"}
        description="It will be removed from the live calendar and kept in the archive audit."
        confirmLabel="Archive"
        cancelLabel="Keep"
        onConfirm={() => archiveResolverRef.current?.(true)}
        onCancel={() => archiveResolverRef.current?.(false)}
      />

      {/* Mobile Editor Sheet */}
      <AdminSheet
        isOpen={Boolean(selectedEventId) && isMobile}
        onClose={() => setSelectedEventId(null)}
        title="Edit Event"
        description="Update schedule record."
      >
        {selectedEvent && (
          <EventEditForm
            event={selectedEvent}
            onUpdate={handleUpdate}
            onArchive={handleArchive}
            onClose={() => setSelectedEventId(null)}
            isSaving={busyState === "update"}
            isArchiving={busyState === "archive"}
            variant="sheet"
          />
        )}
      </AdminSheet>

      <div className="relative mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:space-y-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start lg:justify-between">
          <aside className="w-full lg:w-[320px] lg:shrink-0 space-y-6 lg:sticky lg:top-8 h-fit pb-12">
            <div className="hidden lg:block">
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
            </div>

            <div className="lg:hidden">
              {!selectedEvent && (
                <EventCreationForm
                  onProvision={handleCreate}
                  isSubmitting={busyState === "create"}
                />
              )}
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-4 md:space-y-6">
            <AdminHeader
              title="Events"
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
              <div className={`group relative overflow-hidden rounded-xl border-l-4 p-4 shadow-sm transition-all border-white bg-white ${
                notice.tone === "success" ? "border-l-emerald-500" : "border-l-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 leading-none">
                      {notice.title}
                    </p>
                    <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotice(null)}
                    className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter schedule..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-[11px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300 uppercase tracking-widest"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="sm:col-span-2 xl:col-span-3 py-20 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-100 bg-slate-50/30 p-12 text-center">
                  <div className="rounded-full bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No Matches</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
