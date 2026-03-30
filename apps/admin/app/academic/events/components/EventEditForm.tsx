"use client";

import { useEffect, useState } from "react";
import { X, Pencil, MapPin, Clock, Save, Archive } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

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

interface EventEditFormProps {
  event: EventRecord;
  onUpdate: (id: string, data: {
    title: string;
    location: string | null;
    startDate: string;
    endDate: string;
    description: string | null;
    isAllDay: boolean;
  }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  isArchiving: boolean;
}

export function EventEditForm({
  event,
  onUpdate,
  onArchive,
  onClose,
  isSaving,
  isArchiving,
}: EventEditFormProps) {
  const [title, setTitle] = useState(event.title);
  const [location, setLocation] = useState(event.location ?? "");
  const [startDate, setStartDate] = useState(toDateTimeInputValue(event.startDate));
  const [endDate, setEndDate] = useState(toDateTimeInputValue(event.endDate));
  const [description, setDescription] = useState(event.description ?? "");
  const [isAllDay, setIsAllDay] = useState(event.isAllDay);

  useEffect(() => {
    setTitle(event.title);
    setLocation(event.location ?? "");
    setStartDate(toDateTimeInputValue(event.startDate));
    setEndDate(toDateTimeInputValue(event.endDate));
    setDescription(event.description ?? "");
    setIsAllDay(event.isAllDay);
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;

    await onUpdate(event._id, {
      title: title.trim(),
      location: location.trim() || null,
      startDate,
      endDate,
      description: description.trim() || null,
      isAllDay,
    });
  };

  return (
    <AdminSurface intensity="high" rounded="xl" className="border-slate-950 p-5 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="font-display text-sm font-black uppercase tracking-[0.2em] text-slate-950">
            Edit Event
          </h3>
          <p className="text-[10px] font-bold text-slate-400">
            Modify record parameters.
          </p>
        </div>
        <button 
          onClick={onClose}
          className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
        >
          <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5 focus-within:ring-2 focus-within:ring-slate-950/5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Event Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-300 focus:border-slate-400"
            required
            disabled={isSaving}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Location
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-300 focus:border-slate-400"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Starts
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-slate-400"
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Ends
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-slate-400"
              required
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-300 focus:border-slate-400"
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center gap-3 space-y-0.5 pb-2">
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2.5 transition-all hover:bg-slate-50">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 bg-white text-slate-950 focus:ring-slate-950/10"
              disabled={isSaving}
            />
            <div className="flex items-center gap-2">
               <Clock className="h-3 w-3 text-slate-400" />
               <span className="text-xs font-bold text-slate-600">All-day event</span>
            </div>
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !startDate || !endDate}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50"
          >
            {isSaving ? (
               <span className="flex items-center gap-2">
                 <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                 Saving Changes...
               </span>
            ) : (
              <>
                <Save className="h-4 w-4 text-white/70" />
                Commit Record
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => onArchive(event._id)}
            disabled={isArchiving || isSaving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-4 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50 disabled:opacity-50"
          >
            {isArchiving ? (
               <span className="flex items-center gap-2">
                 <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-500/20 border-t-rose-500" />
                 Archiving...
               </span>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Archive Event
              </>
            )}
          </button>
        </div>
      </form>
    </AdminSurface>
  );
}
