export type DraftSaveState = "idle" | "saving" | "saved" | "offline" | "retrying" | "conflict";

export type DraftConnectivityStatus = { saveState: "offline" | "retrying"; status: string };

export function draftConnectivityStatus(isOnline: boolean, hasPendingDraftWork: boolean): DraftConnectivityStatus | null {
  if (!hasPendingDraftWork) return null;
  return isOnline
    ? { saveState: "retrying", status: "Syncing changes…" }
    : { saveState: "offline", status: "Offline — changes waiting to sync" };
}

type ValidationPolicy = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  choices?: string[];
  min?: number;
  max?: number;
  maxSelections?: number;
};

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

export type EditableDraftValues = Pick<RecoveryRecord, "core" | "contact" | "answers">;

export function restoreEditableDraft(baseline: EditableDraftValues): EditableDraftValues {
  return { core: { ...baseline.core }, contact: { ...baseline.contact }, answers: { ...baseline.answers } };
}

export function resetAutosaveDebounce(current: ReturnType<typeof setTimeout> | null, flush: () => void, debounceMs = 700): ReturnType<typeof setTimeout> {
  if (current !== null) clearTimeout(current);
  return setTimeout(flush, debounceMs);
}

export function startAutosaveCeiling(flush: () => void, ceilingMs = 7000): () => void {
  const ceiling = setInterval(flush, ceilingMs);
  return () => clearInterval(ceiling);
}

export function fieldRequiresValue(requiredMode: string): boolean {
  return requiredMode !== "optional";
}

export function configuredFieldError(field: { kind: string; label: string; validation: string }, serialized: string): string | null {
  if (serialized.length > 16_000) return `${field.label} is too long.`;
  let policy: ValidationPolicy;
  try {
    const parsed: unknown = JSON.parse(field.validation || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    policy = parsed as ValidationPolicy;
  } catch {
    return null;
  }
  let value: string | number | boolean | string[] = serialized;
  if (field.kind === "number") {
    value = Number(serialized);
    if (!Number.isFinite(value)) return `Enter a valid number for ${field.label}.`;
  } else if (field.kind === "boolean" || field.kind === "checkbox") {
    if (serialized !== "true" && serialized !== "false") return `Choose a valid value for ${field.label}.`;
    value = serialized === "true";
  } else if (field.kind === "multi_select") {
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (!Array.isArray(parsed) || parsed.length > 50 || parsed.some(item => typeof item !== "string")) return `Choose valid options for ${field.label}.`;
      value = parsed;
    } catch {
      return `Choose valid options for ${field.label}.`;
    }
  }
  if (typeof value === "string") {
    if (policy.minLength !== undefined && value.length < policy.minLength) return `${field.label} must be at least ${policy.minLength} characters.`;
    if (policy.maxLength !== undefined && value.length > policy.maxLength) return `${field.label} must be at most ${policy.maxLength} characters.`;
    if (policy.pattern) try { if (!new RegExp(policy.pattern, "u").test(value)) return `${field.label} has an invalid format.`; } catch { return null; }
  }
  if (typeof value === "number") {
    if (policy.min !== undefined && value < policy.min) return `${field.label} must be at least ${policy.min}.`;
    if (policy.max !== undefined && value > policy.max) return `${field.label} must be at most ${policy.max}.`;
  }
  const selections = Array.isArray(value) ? value : [value];
  if (Array.isArray(value) && policy.maxSelections !== undefined && value.length > policy.maxSelections) return `Choose no more than ${policy.maxSelections} options for ${field.label}.`;
  if (policy.choices && selections.some(selection => !policy.choices!.includes(String(selection)))) return `Choose one of the listed options for ${field.label}.`;
  return null;
}

export function isTransientSaveFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/ArgumentValidationError/.test(message) || saveErrorCode(error)) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
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

  pause() {
    this.paused = true;
  }

  rebaseWhilePaused(version: number) {
    if (this.paused) this.currentVersion = version;
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
