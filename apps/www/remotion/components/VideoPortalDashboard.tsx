import React from "react";

const history = [
  { session: "2025/2026", term: "First Term", average: "88.3", subjects: 6, active: true },
  { session: "2024/2025", term: "Third Term", average: "84.1", subjects: 7, active: false },
  { session: "2024/2025", term: "Second Term", average: "81.7", subjects: 7, active: false },
];

const notices = [
  {
    title: "PTA meeting reminder",
    body: "Thursday, 4:00 PM at the multipurpose hall.",
    tone: "warning",
  },
  {
    title: "First term report card published",
    body: "Sarah Sunday's result has been approved and is available to view.",
    tone: "success",
  },
];

export const VideoPortalDashboard: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-400">Good afternoon, John</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              Sarah Sunday
            </h1>
            <p className="mt-1 text-sm text-slate-500">Grade 5 A · GA/PRI/0051</p>
          </div>

          <div className="flex gap-2">
            <span className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white">
              Sarah
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-600">
              David
            </span>
          </div>
        </div>

        <p className="text-xs font-medium text-slate-400">
          2025/2026 Session · First Term · Greenwood Academy
        </p>
      </div>

      <section className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Term snapshot</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              Sarah scored an average of <span className="font-bold text-slate-900">88.3%</span> across
              <span className="font-bold text-slate-900"> 6 </span>
              published subjects this term.
            </p>
          </div>
          <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            Open report card
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                  Subject
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                  Score
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["Mathematics", "90", "A"],
                ["English Language", "82", "A"],
                ["Basic Science", "81", "A"],
                ["ICT", "94", "A"],
              ].map(([subject, score, grade]) => (
                <tr key={subject}>
                  <td className="px-4 py-3 font-medium text-slate-700">{subject}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                    {score}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-500">{grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Academic history</h2>
            <span className="text-sm font-semibold text-slate-400">See all →</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Session</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Term</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={`${item.session}-${item.term}`} className={item.active ? "bg-emerald-50/60" : ""}>
                    <td className="px-4 py-3 text-slate-600">{item.session}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.term}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                      {item.average}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">School updates</h2>
          <div className="space-y-1">
            {notices.map((notice) => (
              <div
                key={notice.title}
                className="flex items-start gap-3 rounded-lg bg-white px-3 py-3 transition-colors"
              >
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    notice.tone === "success" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{notice.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{notice.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Billing status
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Second Term Fees</p>
                <p className="text-xs text-slate-500">No outstanding balance.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Settled
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
