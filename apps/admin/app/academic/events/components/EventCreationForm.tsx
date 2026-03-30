"use client";

import { useState } from "react";
import { CalendarPlus2, MapPin, Clock } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

interface EventCreationFormProps {
  onProvision: (data: {
    title: string;
    location: string | null;
    startDate: string;
    endDate: string;
    description: string | null;
    isAllDay: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function EventCreationForm({
  onProvision,
  isSubmitting,
}: EventCreationFormProps) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;

    await onProvision({
      title: title.trim(),
      location: location.trim() || null,
      startDate,
      endDate,
      description: description.trim() || null,
      isAllDay,
    });

    setTitle("");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setIsAllDay(false);
  };

  return (
    <AdminSurface intensity="high" rounded="xl" className="border-slate-950 p-5 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="font-display text-sm font-black uppercase tracking-[0.2em] text-slate-950">
            Schedule Event
          </h3>
          <p className="text-[10px] font-bold text-slate-400">
            Provision new calendar entries.
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <CalendarPlus2 size={16} />
        </div>
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
            placeholder="e.g. Inter-house sports"
            required
            disabled={isSubmitting}
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
              placeholder="Main Field"
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
            placeholder="Add a brief summary..."
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center gap-3 space-y-0.5">
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2.5 transition-all hover:bg-slate-50">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 bg-white text-slate-950 focus:ring-slate-950/10"
              disabled={isSubmitting}
            />
            <div className="flex items-center gap-2">
               <Clock className="h-3 w-3 text-slate-400" />
               <span className="text-xs font-bold text-slate-600">All-day event</span>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !startDate || !endDate}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? (
             <span className="flex items-center gap-2">
               <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
               Provisioning...
             </span>
          ) : (
            <>
              <CalendarPlus2 className="h-4 w-4 text-white/70" />
              Confirm Entry
            </>
          )}
        </button>
      </form>
    </AdminSurface>
  );
}
