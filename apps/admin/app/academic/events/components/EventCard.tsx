"use client";

import { Calendar, MapPin, Archive, Clock } from "lucide-react";
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

interface EventCardProps {
  event: EventRecord;
  isSelected?: boolean;
  onSelect: () => void;
  onArchive: () => void;
}

export function EventCard({
  event,
  isSelected,
  onSelect,
  onArchive,
}: EventCardProps) {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AdminSurface
      as="article"
      intensity={isSelected ? "high" : "medium"}
      rounded="lg"
      className={`relative p-3.5 transition-all duration-300 cursor-pointer group ${
        isSelected ? "ring-2 ring-slate-950 shadow-md" : "hover:border-slate-300 hover:shadow-md"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
            isSelected ? "bg-slate-950 text-white shadow-sm" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
          }`}>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-0">
            <h4 className="font-display text-sm font-bold tracking-tight text-slate-950 truncate">
              {event.title}
            </h4>
            <div className="flex flex-col">
              <p className="text-[11px] font-medium text-slate-400 truncate flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.isAllDay ? "All Day" : `${formatTime(startDate)} - ${formatTime(endDate)}`}
              </p>
              {event.location && (
                <p className="text-[10px] font-bold text-slate-300 truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Event Date
          </p>
          <p className="font-display text-[11px] font-bold text-slate-500">
            {formatDate(startDate)}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3 border-t border-slate-50 pt-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Status
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <span className={`inline-flex h-5 items-center px-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${
              event.endDate >= Date.now() 
                ? "bg-emerald-50 border border-emerald-100 text-emerald-600" 
                : "bg-slate-50 border border-slate-100 text-slate-400"
            }`}>
              {event.endDate >= Date.now() ? "Upcoming" : "Past"}
            </span>
            {event.isAllDay && (
              <span className="inline-flex h-5 items-center px-1.5 rounded-md bg-blue-50 border border-blue-100 text-[9px] font-bold uppercase tracking-widest text-blue-600">
                All Day
              </span>
            )}
          </div>
        </div>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-100 bg-white px-2 text-[10px] font-bold uppercase tracking-widest text-rose-500 transition-all hover:bg-rose-50"
        >
          <Archive className="h-3 w-3 opacity-60" />
          Archive
        </button>
      </div>
    </AdminSurface>
  );
}
