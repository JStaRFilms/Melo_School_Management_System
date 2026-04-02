"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRightLeft, Loader2, Sparkles } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminSurface } from "@/components/ui/AdminSurface";

interface TeacherRecord {
  _id: string;
  name: string;
  email: string;
}

interface TeacherPromotionSectionProps {
  teachers: TeacherRecord[];
  onSuccess: (message: string) => void;
  onError: (title: string, message: string) => void;
}

export function TeacherPromotionSection({
  teachers,
  onSuccess,
  onError,
}: TeacherPromotionSectionProps) {
  const promoteTeacherToAdmin = useMutation(
    "functions/academic/adminLeadership:promoteTeacherToAdmin" as never
  );

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const submitPromoteTeacher = async () => {
    if (!selectedTeacherId) {
      return;
    }

    setIsBusy(true);

    try {
      await promoteTeacherToAdmin({ teacherId: selectedTeacherId } as never);
      setSelectedTeacherId("");
      onSuccess("Identity elevated. Teaching credentials preserved.");
    } catch (error) {
      onError("Elevation failed", getUserFacingErrorMessage(error, "We could not promote that teacher right now."));
    } finally {
      setIsBusy(false);
    }
  };

  const selectedTeacher = teachers.find((t) => t._id === selectedTeacherId);

  return (
    <AdminSurface intensity="low" rounded="lg" className="p-4 ring-1 ring-slate-950/5">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-950/5 pb-2.5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-950">
            Promote Teacher
          </h2>
        </div>
        <div className="rounded-lg bg-white p-1.5 text-slate-400 shadow-sm ring-1 ring-slate-950/5">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 pl-1">
            Select Teacher
          </label>
          <div className="relative">
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem'
              }}
            >
              <option value="">Choose teacher...</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedTeacherId || isBusy}
          onClick={() => void submitPromoteTeacher()}
          className="group relative inline-flex h-9 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-emerald-600 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/20 disabled:opacity-50"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-3.5 w-3.5 opacity-60 transition-opacity" />
          )}
          {isBusy ? "Processing..." : "Promote to Admin"}
        </button>
      </div>
    </AdminSurface>
  );
}
