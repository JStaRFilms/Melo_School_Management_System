export type DraftSaveState = "idle" | "saving" | "saved" | "offline" | "retrying" | "conflict";

export type RecoveryRecord = {
  baseVersion: number;
  generation: number;
  dirtySections: string[];
  dirtyEntries: Array<{ key: string; section: string }>;
  core: { firstName: string; lastName: string; dateOfBirth: string };
  contact: { fullName: string; relationship: string; email: string; phone: string };
  answers: Record<string, string>;
};

export const recoveryKey = (schoolSlug: string, publicReference: string) =>
  `apply:draft-recovery:${schoolSlug}:${publicReference}`;

export function readRecovery(key: string): RecoveryRecord | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Partial<RecoveryRecord>;
    if (typeof record.baseVersion !== "number" || typeof record.generation !== "number" || !Array.isArray(record.dirtySections) || !Array.isArray(record.dirtyEntries) || !record.core || !record.contact || !record.answers) return null;
    return record as RecoveryRecord;
  } catch {
    return null;
  }
}

export function nextFormStep(steps: string[], current: string): string | null {
  return steps[steps.indexOf(current) + 1] ?? null;
}

export function isTransientSaveFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|offline|temporar|timeout/i.test(message);
}

export function saveErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/(DRAFT_VERSION_CONFLICT|APPLICATION_INCOMPLETE|ANSWER_INVALID|ANSWER_NOT_APPLICABLE|CORE_FIELD_LOCKED)/);
  return match?.[1] ?? null;
}

const pauseError = new Error("DRAFT_SAVE_PAUSED");

export class SerializedWriteQueue {
  private tail: Promise<void> = Promise.resolve();
  private paused = false;
  private currentVersion: number;

  constructor(version: number) {
    this.currentVersion = version;
  }

  setVersion(version: number) {
    if (!this.paused) this.currentVersion = version;
  }

  resume(version: number) {
    this.currentVersion = version;
    this.paused = false;
  }

  isPaused() {
    return this.paused;
  }

  enqueue(write: (expectedVersion: number) => Promise<number>, onRetry: () => void): Promise<number> {
    const run = this.tail.then(async () => {
      if (this.paused) throw pauseError;
      let attempt = 0;
      while (true) {
        try {
          const nextVersion = await write(this.currentVersion);
          this.currentVersion = nextVersion;
          return nextVersion;
        } catch (error) {
          if (saveErrorCode(error) === "DRAFT_VERSION_CONFLICT") this.paused = true;
          if (this.paused || !isTransientSaveFailure(error) || attempt === 2) throw error;
          onRetry();
          await new Promise(resolve => setTimeout(resolve, [500, 1500][attempt]));
          attempt += 1;
        }
      }
    });
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }
}
