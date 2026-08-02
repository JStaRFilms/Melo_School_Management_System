import { describe, expect, test } from "vitest";
import { nextFormStep, saveErrorCode, SerializedWriteQueue } from "../lib/draftAutosave";

describe("draft autosave queue", () => {
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

  test("pauses rather than retrying an optimistic concurrency conflict", async () => {
    const queue = new SerializedWriteQueue(2);
    await expect(queue.enqueue(async () => { throw new Error("DRAFT_VERSION_CONFLICT"); }, () => { throw new Error("should not retry"); })).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    await expect(queue.enqueue(async () => 3, () => undefined)).rejects.toThrow("DRAFT_SAVE_PAUSED");
    expect(queue.isPaused()).toBe(true);
  });

  test("keeps progression within the configured section order and recognizes safe error codes", () => {
    expect(nextFormStep(["child", "contacts", "review"], "child")).toBe("contacts");
    expect(nextFormStep(["child", "contacts", "review"], "review")).toBeNull();
    expect(saveErrorCode(new Error("ANSWER_INVALID"))).toBe("ANSWER_INVALID");
    expect(saveErrorCode(new Error("database record details"))).toBeNull();
  });
});
