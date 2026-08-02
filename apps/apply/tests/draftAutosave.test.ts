import { afterEach, describe, expect, test, vi } from "vitest";
import { configuredFieldError, nextFormStep, saveErrorCode, SerializedWriteQueue, startAutosaveSchedule } from "../lib/draftAutosave";

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

  test("keeps its ceiling timer active independently of debounce timing", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const stop = startAutosaveSchedule(flush);

    vi.advanceTimersByTime(700);
    expect(flush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6300);
    expect(flush).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(7000);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  test("pauses conflicts until an explicit retry, including restored local edits", async () => {
    const queue = new SerializedWriteQueue(2);
    await expect(queue.enqueue(async () => { throw new Error("DRAFT_VERSION_CONFLICT"); }, () => { throw new Error("should not retry"); })).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    queue.rebaseWhilePaused(4);
    await expect(queue.enqueue(async () => 5, () => undefined)).rejects.toThrow("DRAFT_SAVE_PAUSED");
    queue.resume(4);
    await expect(queue.enqueue(async expectedVersion => expectedVersion + 1, () => undefined)).resolves.toBe(5);
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
  });
});
