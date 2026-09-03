// School Management System - Shared Package

export * from "./name-format";
export * from "./errors";
export * from "./workspace-navigation";
export * from "./report-card-routes";
export * from "./planning-routes";
export * from "./planning-context";
export * from "./toast";

// Components
export { WorkspaceNavbar } from "./components/WorkspaceNavbar";
export type { WorkspaceNavbarProps } from "./components/WorkspaceNavbar";
export { ReportCardSheet } from "./components/ReportCardSheet";
export type { ReportCardSheetData } from "./components/ReportCardSheet";
export { ReportCardPreview } from "./components/ReportCardPreview";
export { ReportCardToolbar, ReportCardPrintBlockedNotice } from "./components/ReportCardToolbar";
export { ReportCardBatchNavigator } from "./components/ReportCardBatchNavigator";
export type { ReportCardBatchStudent } from "./components/ReportCardBatchNavigator";
export { ReportCardPrintStack } from "./components/ReportCardPrintStack";
export { ReportCardBatchPrintStackV2 } from "./components/ReportCardBatchPrintStackV2";
export { MeloLoader } from "./components/MeloLoader";
export { ChangePasswordModal } from "./components/ChangePasswordModal";
export type { ChangePasswordModalProps } from "./components/ChangePasswordModal";
export { SchoolSuspendedLockScreen } from "./components/SchoolSuspendedLockScreen";
export type { SuspendedSchoolDetails } from "./components/SchoolSuspendedLockScreen";
export { AuthoritativeForbiddenView } from "./components/AuthoritativeForbiddenView";
export type { AuthoritativeForbiddenViewProps } from "./components/AuthoritativeForbiddenView";
export { BranchSwitcher } from "./components/BranchSwitcher";
export type { BranchSwitcherProps, BranchSummary } from "./components/BranchSwitcher";
export { UnsavedBranchSwitchModal } from "./components/UnsavedBranchSwitchModal";
export type { UnsavedBranchSwitchModalProps } from "./components/UnsavedBranchSwitchModal";
export { useAutoAnimate } from "@formkit/auto-animate/react";

// Exam Recording Domain
export * from "./exam-recording";
export * from "./cumulative-results";
export * from "./subject-aggregation";
export * from "./admissions-foundation";
export * from "./academic-timeline";
export * from "./migration";
export * from "./components/migration";


