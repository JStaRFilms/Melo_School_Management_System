export type ReportCardRouteInput = {
  studentId?: string | null;
  sessionId?: string | null;
  termId?: string | null;
  classId?: string | null;
};

function buildStudentReportCardQuery(args: ReportCardRouteInput) {
  if (!args.studentId || !args.sessionId || !args.termId) {
    return null;
  }

  const params = new URLSearchParams({
    studentId: args.studentId,
    sessionId: args.sessionId,
    termId: args.termId,
  });

  if (args.classId) {
    params.set("classId", args.classId);
  }

  return params;
}

export function buildReportCardHref(args: ReportCardRouteInput) {
  const params = buildStudentReportCardQuery(args);

  return params ? `/assessments/report-cards?${params.toString()}` : undefined;
}

export function buildReportCardExtrasHref(args: ReportCardRouteInput) {
  const params = buildStudentReportCardQuery(args);

  return params
    ? `/assessments/report-card-extras?${params.toString()}`
    : undefined;
}

