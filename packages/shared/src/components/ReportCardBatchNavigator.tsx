"use client";

export type ReportCardBatchStudent = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
};

export function ReportCardBatchNavigator({
  students,
  activeStudentId,
  className,
  sessionName,
  termName,
  isLoading,
  isPrintingFullClass,
  onSelectStudent,
  onPrintFullClass,
  extrasHref,
}: {
  students: ReportCardBatchStudent[];
  activeStudentId: string;
  className: string;
  sessionName: string;
  termName: string;
  isLoading?: boolean;
  isPrintingFullClass?: boolean;
  onSelectStudent: (studentId: string) => void;
  onPrintFullClass?: () => void;
  extrasHref?: string;
}) {
  const activeIndex = students.findIndex(
    (student) => student.studentId === activeStudentId
  );
  const previousStudent =
    activeIndex > 0 ? students[activeIndex - 1] : null;
  const nextStudent =
    activeIndex >= 0 && activeIndex < students.length - 1
      ? students[activeIndex + 1]
      : null;

  return (
    <div className="rc-no-print mx-auto px-4 pt-6 md:px-6" style={{ maxWidth: "210mm" }}>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              Batch Report Cards
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">
              {className}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {sessionName} · {termName}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {isLoading
              ? "Loading class roster..."
              : `${students.length} student${students.length === 1 ? "" : "s"} in this print run`}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Jump to student
              </span>
              <select
                value={activeStudentId}
                onChange={(event) => onSelectStudent(event.target.value)}
                disabled={isLoading || students.length === 0}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {students.length === 0 ? (
                  <option value={activeStudentId}>No students available</option>
                ) : null}
                {students.map((student, index) => (
                  <option key={student.studentId} value={student.studentId}>
                    {index + 1}. {student.studentName} ({student.admissionNumber})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-end gap-2">
            {extrasHref ? (
              <a
                href={extrasHref}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
              >
                Report Extras
              </a>
            ) : null}
            {onPrintFullClass ? (
              <button
                type="button"
                onClick={onPrintFullClass}
                disabled={isLoading || students.length === 0 || isPrintingFullClass}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPrintingFullClass ? "Preparing full class..." : "Print Full Class"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => previousStudent && onSelectStudent(previousStudent.studentId)}
              disabled={!previousStudent}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => nextStudent && onSelectStudent(nextStudent.studentId)}
              disabled={!nextStudent}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
