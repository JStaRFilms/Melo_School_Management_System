"use client";

import { useMemo, useState } from "react";
import { isConvexConfigured } from "@/convex-runtime";
import {
  getMockPortalBillingData,
  getMockPortalWorkspaceData,
} from "@/mock-portal-data";
import type { PortalBillingInvoice, PortalHistoryItem, PortalWorkspaceMode } from "@/portal-types";
import {
  PortalWorkspaceContent,
  PortalWorkspaceView,
} from "./portal-workspace/PortalWorkspaceContent";

export function PortalWorkspace({ mode }: { mode: PortalWorkspaceMode }) {
  if (!isConvexConfigured()) {
    return <MockPortalWorkspace mode={mode} />;
  }

  return <PortalWorkspaceContent mode={mode} />;
}

function MockPortalWorkspace({ mode }: { mode: PortalWorkspaceMode }) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const historyLimit = mode === "results" ? 8 : mode === "report-cards" ? 6 : 4;
  const workspace = useMemo(
    () => getMockPortalWorkspaceData({ studentId, sessionId, termId, historyLimit }),
    [historyLimit, sessionId, studentId, termId]
  );
  const billing = useMemo(
    () => (mode === "billing" ? getMockPortalBillingData(workspace.selectedStudentId) : undefined),
    [mode, workspace.selectedStudentId]
  );

  const handleSelectStudent = (nextStudentId: string) => {
    setStudentId(nextStudentId);
    setSessionId(null);
    setTermId(null);
    setBillingNotice(null);
  };

  const handleSelectHistoryItem = (item: PortalHistoryItem) => {
    setStudentId(workspace.selectedStudentId);
    setSessionId(item.sessionId);
    setTermId(item.termId);
  };

  const handleStartPortalPayment = async (invoice: PortalBillingInvoice) => {
    setBillingNotice(null);
    setPayingInvoiceId(invoice.invoiceId);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    setPayingInvoiceId(null);
    setBillingNotice("Demo mode: payment checkout is mocked for video capture.");
  };

  return (
    <PortalWorkspaceView
      mode={mode}
      workspace={workspace}
      billing={billing}
      billingNotice={billingNotice}
      payingInvoiceId={payingInvoiceId}
      onSelectHistoryItem={handleSelectHistoryItem}
      onSelectStudent={handleSelectStudent}
      onPayNow={handleStartPortalPayment}
    />
  );
}
