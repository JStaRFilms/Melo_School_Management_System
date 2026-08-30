import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@school/convex/_generated/api";
import type { BillingDashboardData, DashboardFilters, ClassOption, SessionOption, TermOption, StudentOption } from "../types";
import { toQueryArgs } from "../utils";

export function useBillingData(filters: DashboardFilters, invoiceDraft: any, feePlanApplicationDraft: any) {
  const dashboardArgs = {
    classId: filters.classId ? filters.classId : null,
    sessionId: filters.sessionId ? filters.sessionId : null,
    termId: filters.termId ? filters.termId : null,
    status: filters.status ? filters.status : null,
    search: filters.search.trim() ? filters.search.trim() : undefined,
  };

  const data = useQuery(api.functions.billing.getBillingDashboard, dashboardArgs) as
    | BillingDashboardData
    | undefined;

  const classes = useQuery(api.functions.academic.academicSetup.listClasses) as
    | ClassOption[]
    | undefined;

  const sessions = useQuery(api.functions.academic.academicSetup.listSessions) as
    | SessionOption[]
    | undefined;

  const filterTerms = useQuery(
    api.functions.academic.academicSetup.listTermsBySession,
    toQueryArgs("sessionId", filters.sessionId)
  ) as TermOption[] | undefined;

  const invoiceTerms = useQuery(
    api.functions.academic.academicSetup.listTermsBySession,
    toQueryArgs("sessionId", invoiceDraft.sessionId)
  ) as TermOption[] | undefined;

  const invoiceStudents = useQuery(
    api.functions.academic.studentEnrollment.listStudentsByClass,
    toQueryArgs("classId", invoiceDraft.classId)
  ) as StudentOption[] | undefined;

  const applicationTerms = useQuery(
    api.functions.academic.academicSetup.listTermsBySession,
    toQueryArgs("sessionId", feePlanApplicationDraft.sessionId)
  ) as TermOption[] | undefined;

  const schoolPaymentAttemptRows = useQuery(
    api.functions.billing.listBillingPaymentAttempts,
    { status: null, limit: 50 }
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
