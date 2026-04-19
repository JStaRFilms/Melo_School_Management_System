import React from "react";
import {
  GraduationCap,
  Sparkles,
  Users,
  Wallet,
  ArrowUpRight,
} from "lucide-react";

const stats = [
  { label: "Registered", value: "1,248", icon: Users },
  { label: "Active Access", value: "1,212", icon: Sparkles },
  { label: "Classes", value: "34", icon: GraduationCap },
  { label: "Outstanding", value: "N5.7M", icon: Wallet },
];

const teachers = [
  { name: "Mrs. Tolani Ajayi", email: "tolani@greenwood.edu.ng", status: "Active" },
  { name: "Mr. David Okafor", email: "david@greenwood.edu.ng", status: "On Leave" },
  { name: "Mrs. Blessing Edet", email: "blessing@greenwood.edu.ng", status: "Active" },
];

export const VideoAdminDashboard: React.FC = () => {
  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            School operations
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
            Teaching Staff
          </h1>
          <p className="max-w-xl text-[13px] font-medium leading-relaxed text-slate-500">
            Manage faculty records, academic coverage, and school-wide staff access.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="min-w-[122px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-950/5"
            >
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-400">
                  <stat.icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  {stat.label}
                </p>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 px-0.5">
                <span className="text-xl font-black tracking-tight text-slate-950">
                  {stat.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-950/5 px-6 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Active records
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Faculty accounts linked to school email addresses.
              </p>
            </div>
            <button className="rounded-2xl bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20">
              New Teacher
            </button>
          </div>

          <div className="grid gap-3 p-4">
            {teachers.map((teacher, index) => (
              <article
                key={teacher.email}
                className={`rounded-lg border p-3.5 transition-all ${
                  index === 0
                    ? "border-slate-300 bg-white shadow-md ring-2 ring-slate-950"
                    : "border-slate-200/60 bg-white shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${
                        index === 0
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {teacher.name
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold tracking-tight text-slate-950">
                        {teacher.name}
                      </h4>
                      <p className="truncate text-[11px] font-medium text-slate-400">
                        {teacher.email}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-bold uppercase tracking-widest ${
                      teacher.status === "On Leave"
                        ? "border-amber-100 bg-amber-50 text-amber-600"
                        : "border-emerald-100 bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {teacher.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  System notification
                </p>
                <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-950">
                  Academic coverage stable
                </h3>
              </div>
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              All classes have at least one assigned teacher. Two pending leave approvals need review.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-950/5 px-6 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Department pulse
              </p>
            </div>
            <div className="space-y-4 p-6">
              <Progress label="Senior Secondary" value={88} />
              <Progress label="Junior Secondary" value={92} />
              <Progress label="Primary Education" value={81} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
