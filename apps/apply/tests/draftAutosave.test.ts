import { afterEach, describe, expect, test, vi } from "vitest";
import { configuredFieldError, fieldRequiresValue, isTransientSaveFailure, nextFormStep, resetAutosaveDebounce, restoreEditableDraft, saveErrorCode, SerializedWriteQueue, startAutosaveCeiling } from "../lib/draftAutosave";

describe("draft autosave queue", () => {
  afterEach(() => { vi.useRealTimers(); });

  test("serializes writes and uses the acknowledged version for the next edit", async () => {
    const queue = new SerializedWriteQueue(4);
    const versions: number[] = [];
    let completeFirst: ((version: number) => void) | undefined;
    const first = queue.enqueue(expectedVersion => {
      versions.push(expectedVersion);
      return new Promise(resolve => { completeFirst = resolve; });
    }, () => undefined);
    const second = queue.enqueue(async expectedVersion => {
      versions.push(expectedVersion);
      return 6;
    }, () => undefined);

    await Promise.resolve();
    expect(versions).toEqual([4]);
    completeFirst?.(5);
    await expect(first).resolves.toBe(5);
    await expect(second).resolves.toBe(6);
    expect(versions).toEqual([4, 5]);
  });

  test("keeps the application version after a serialized document bind", async () => {
    const queue = new SerializedWriteQueue(8);
    const bindDocument = vi.fn(async () => ({ version: 1 }));
    const documentVersion = await queue.enqueue(async expectedVersion => {
      expect(expectedVersion).toBe(8);
      expect((await bindDocument()).version).toBe(1);
      return expectedVersion;
    }, () => undefined);
    const nextWriteVersion = await queue.enqueue(async expectedVersion => expectedVersion + 1, () => undefined);

    expect(documentVersion).toBe(8);
    expect(nextWriteVersion).toBe(9);
  });

  test("resets debounce for edits without postponing the stable ceiling", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const stop = startAutosaveCeiling(flush);
    let debounce = resetAutosaveDebounce(null, flush);

    vi.advanceTimersByTime(500);
    debounce = resetAutosaveDebounce(debounce, flush);
    vi.advanceTimersByTime(699);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5300);
    resetAutosaveDebounce(debounce, flush);
    vi.advanceTimersByTime(500);
    expect(flush).toHaveBeenCalledTimes(2);
    stop();
  });

  test("pauses conflicts until an explicit retry, including restored local edits", async () => {
    const queue = new SerializedWriteQueue(2);
    await expect(queue.enqueue(async () => { throw new Error("DRAFT_VERSION_CONFLICT"); }, () => { throw new Error("should not retry"); })).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    queue.rebaseWhilePaused(4);
    await expect(queue.enqueue(async () => 5, () => undefined)).rejects.toThrow("DRAFT_SAVE_PAUSED");
    queue.resume(4);
    await expect(queue.enqueue(async expectedVersion => expectedVersion + 1, () => undefined)).resolves.toBe(5);
  });

  test("restores a discarded recovery copy from the latest server baseline", () => {
    const baseline = { core: { firstName: "Server", lastName: "Child", dateOfBirth: "2020-01-01" }, contact: { fullName: "Server Guardian", relationship: "Parent", email: "server@example.test", phone: "1" }, answers: { entry: "day" } };
    const restored = restoreEditableDraft(baseline);
    restored.core.firstName = "Local";
    restored.answers.entry = "board";

    expect(baseline).toMatchObject({ core: { firstName: "Server" }, answers: { entry: "day" } });
    expect(restoreEditableDraft(baseline)).toEqual(baseline);
  });

  test("requires visible conditional fields while leaving optional fields unrequired", () => {
    expect(fieldRequiresValue("required")).toBe(true);
    expect(fieldRequiresValue("conditional")).toBe(true);
    expect(fieldRequiresValue("optional")).toBe(false);
  });

  test("returns named errors for configured closed validation constraints", () => {
    expect(configuredFieldError({ kind: "select", label: "Entry choice", validation: '{"choices":["day","board"]}' }, "invalid")).toContain("Entry choice");
    expect(configuredFieldError({ kind: "number", label: "Age", validation: '{"min":4,"max":18}' }, "3")).toContain("Age");
    expect(configuredFieldError({ kind: "text", label: "Reference", validation: '{"pattern":"^[A-Z]+$","minLength":3}' }, "ab")).toContain("Reference");
  });

  test("keeps progression within the configured section order and recognizes safe error codes", () => {
    expect(nextFormStep(["child", "contacts", "review"], "child")).toBe("contacts");
    expect(nextFormStep(["child", "contacts", "review"], "review")).toBeNull();
    expect(saveErrorCode(new Error("ANSWER_INVALID"))).toBe("ANSWER_INVALID");
    expect(saveErrorCode(new Error("database record details"))).toBeNull();
    expect(isTransientSaveFailure(new Error("network request failed"))).toBe(true);
    expect(isTransientSaveFailure(new Error("ArgumentValidationError"))).toBe(false);
  });
});
