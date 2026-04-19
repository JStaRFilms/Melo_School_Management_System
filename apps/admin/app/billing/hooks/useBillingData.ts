import { useQuery } from "convex/react";
import { useMemo } from "react";
import type { BillingDashboardData, DashboardFilters, ClassOption, SessionOption, TermOption, StudentOption } from "../types";
import { toQueryArgs } from "../utils";

export function useBillingData(filters: DashboardFilters, invoiceDraft: any, feePlanApplicationDraft: any) {
  const dashboardArgs = {
    classId: filters.classId ? (filters.classId as never) : (null as never),
    sessionId: filters.sessionId ? (filters.sessionId as never) : (null as never),
    termId: filters.termId ? (filters.termId as never) : (null as never),
    status: filters.status ? (filters.status as never) : (null as never),
    search: filters.search.trim() ? filters.search.trim() : undefined,
  };

  const data = useQuery("functions/billing:getBillingDashboard" as never, dashboardArgs as never) as
    | BillingDashboardData
    | undefined;

  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as
    | ClassOption[]
    | undefined;

  const sessions = useQuery("functions/academic/academicSetup:listSessions" as never) as
    | SessionOption[]
    | undefined;

  const filterTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", filters.sessionId)
  ) as TermOption[] | undefined;

  const invoiceTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", invoiceDraft.sessionId)
  ) as TermOption[] | undefined;

  const invoiceStudents = useQuery(
    "functions/academic/studentEnrollment:listStudentsByClass" as never,
    toQueryArgs("classId", invoiceDraft.classId)
  ) as StudentOption[] | undefined;

  const applicationTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", feePlanApplicationDraft.sessionId)
  ) as TermOption[] | undefined;

  const schoolPaymentAttemptRows = useQuery(
    "functions/billing:listBillingPaymentAttempts" as never,
    { status: null, limit: 50 } as never
  ) as BillingDashboardData["paymentAttempts"] | undefined;

  const classNameById = useMemo(
    () => new Map((classes ?? []).map((classOption) => [classOption._id, classOption.name])),
    [classes]
  );

  return {
    data,
    classes,
    sessions,
    filterTerms,
    invoiceTerms,
    invoiceStudents,
    applicationTerms,
    schoolPaymentAttemptRows,
    classNameById,
  };
}
