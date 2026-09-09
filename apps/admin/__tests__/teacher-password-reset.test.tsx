import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TeacherEditForm } from "../app/academic/teachers/components/TeacherEditForm";
import type { TeacherRecord } from "../types";

const mockTeacher: TeacherRecord = {
  _id: "teacher-123",
  name: "Dr. Tariq Adeleke",
  email: "t.adeleke@meridiancrest.org",
  role: "teacher",
  archiveBlockers: [],
};

describe("TeacherEditForm Identity & Password Reset Controls", () => {
  it("renders the Reset Password and Danger Zone sections when permissions are granted", () => {
    const onUpdate = vi.fn();
    const onResetPassword = vi.fn();
    const onArchive = vi.fn();
    const onClose = vi.fn();

    render(
      <TeacherEditForm
        teacher={mockTeacher}
        onUpdate={onUpdate}
        onResetPassword={onResetPassword}
        onArchive={onArchive}
        onClose={onClose}
        isSaving={false}
        isResetting={false}
        canEditProfile={true}
        canResetPassword={true}
        canArchive={true}
      />
    );

    // Profile fields
    expect(screen.getByText(/Full Name/i)).toBeTruthy();
    expect(screen.getByDisplayValue("Dr. Tariq Adeleke")).toBeTruthy();
    expect(screen.getByText(/Email Address/i)).toBeTruthy();
    expect(screen.getByDisplayValue("t.adeleke@meridiancrest.org")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update Teacher/i })).toBeTruthy();

    // Password reset field & button
    expect(screen.getByText(/Reset Password/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Enter new temporary password/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update temporary password/i })).toBeTruthy();

    // Danger zone
    expect(screen.getByText(/Danger Zone/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Archive/i })).toBeTruthy();
  });

  it("submits the new temporary password when KeyRound button is clicked", async () => {
    const onResetPassword = vi.fn().mockResolvedValue(undefined);

    render(
      <TeacherEditForm
        teacher={mockTeacher}
        onUpdate={vi.fn()}
        onResetPassword={onResetPassword}
        onArchive={vi.fn()}
        onClose={vi.fn()}
        isSaving={false}
        isResetting={false}
        canEditProfile={true}
        canResetPassword={true}
        canArchive={true}
      />
    );

    const input = screen.getByPlaceholderText(/Enter new temporary password/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "NewTempSecret2026!" } });
    });

    const submitBtn = screen.getByRole("button", { name: /Update temporary password/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(onResetPassword).toHaveBeenCalledWith("teacher-123", "NewTempSecret2026!");
  });

  it("hides password reset and archive sections when capabilities are explicitly withheld", () => {
    render(
      <TeacherEditForm
        teacher={mockTeacher}
        onUpdate={vi.fn()}
        onResetPassword={vi.fn()}
        onArchive={vi.fn()}
        onClose={vi.fn()}
        isSaving={false}
        isResetting={false}
        canEditProfile={true}
        canResetPassword={false}
        canArchive={false}
      />
    );

    expect(screen.queryByText(/Reset Password/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/Enter new temporary password/i)).toBeNull();
    expect(screen.queryByText(/Danger Zone/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Archive/i })).toBeNull();
  });
});
