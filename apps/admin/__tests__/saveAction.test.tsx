import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSaveAction } from "@school/shared/examSelection/client";

const messages = { toastId: "test-save", errorTitle: "Unable to save" };

describe("useSaveAction (consolidation P21)", () => {
  it("saves once and reports success", async () => {
    const onSave = vi.fn(async () => "ok");
    const { result } = renderHook(() =>
      useSaveAction({ hasUnsavedChanges: true, isEditingLocked: false, dirtyCount: 2, onSave, messages }),
    );
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
  });

  it("blocks locked, clean, and in-flight saves", async () => {
    const onSave = vi.fn(async () => "ok");
    const locked = renderHook(() =>
      useSaveAction({ hasUnsavedChanges: true, isEditingLocked: true, dirtyCount: 1, onSave, messages }),
    );
    await act(async () => {
      await locked.result.current.handleSave();
    });
    const clean = renderHook(() =>
      useSaveAction({ hasUnsavedChanges: false, isEditingLocked: false, dirtyCount: 0, onSave, messages }),
    );
    await act(async () => {
      await clean.result.current.handleSave();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("recovers from save failures", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("boom");
    });
    const { result } = renderHook(() =>
      useSaveAction({ hasUnsavedChanges: true, isEditingLocked: false, dirtyCount: 1, onSave, messages }),
    );
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("absorbs toast-handled errors without failing", async () => {
    const onSave = vi.fn(async () => {
      throw { toastHandled: true };
    });
    const { result } = renderHook(() =>
      useSaveAction({ hasUnsavedChanges: true, isEditingLocked: false, dirtyCount: 1, onSave, messages }),
    );
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
  });
});
