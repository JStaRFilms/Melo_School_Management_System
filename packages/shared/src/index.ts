// School Management System - Shared Package

export * from "./name-format";
export * from "./errors";
export * from "./workspace-navigation";
export * from "./report-card-routes";

// Components
export { WorkspaceNavbar } from "./components/WorkspaceNavbar";
export type { WorkspaceNavbarProps } from "./components/WorkspaceNavbar";
export { ReportCardSheet } from "./components/ReportCardSheet";
export type { ReportCardSheetData } from "./components/ReportCardSheet";
export { ReportCardBatchNavigator } from "./components/ReportCardBatchNavigator";
export type { ReportCardBatchStudent } from "./components/ReportCardBatchNavigator";
export { ReportCardPrintStack } from "./components/ReportCardPrintStack";

// Exam Recording Domain
export * from "./exam-recording";
export * from "./subject-aggregation";
