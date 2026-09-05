"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  parseDraftPayload,
  useFormDraft,
  type DraftConnection,
  type DraftFormKey,
  type DraftPayload,
  type FormDraftSummary,
} from "@school/shared/drafts";
import type { Id } from "@school/convex/_generated/dataModel";

type DraftScope = {
  schoolId: Id<"schools">;
  formKey: string;
  entityId?: string;
};
type DraftRecord = DraftScope & {
  draftId: Id<"formDrafts">;
  payload: unknown;
  revision?: number;
  lastSavedAt: number;
  expiresAt?: number;
  schemaVersion?: number;
};
type DraftInstance = {
  schoolId: Id<"schools">;
  draftId: Id<"formDrafts">;
  expectedRevision: number;
};
type SaveArgs = DraftInstance & { schemaVersion: number; payload: unknown };

const getDraft = makeFunctionReference<"query", DraftScope, DraftRecord | null>(
  "functions/academic/drafts:getFormDraft",
);
const beginDraft = makeFunctionReference<
  "mutation",
  DraftScope & { schemaVersion: number },
  { draftId: Id<"formDrafts">; revision: number; expiresAt: number }
>("functions/academic/drafts:beginFormDraft");
const saveDraft = makeFunctionReference<
  "mutation",
  SaveArgs,
  { draftId: Id<"formDrafts">; revision: number; lastSavedAt: number }
>("functions/academic/drafts:saveFormDraft");
const discardDraft = makeFunctionReference<"mutation", DraftInstance, { success: true }>(
  "functions/academic/drafts:discardFormDraft",
);
const commitDraft = makeFunctionReference<"mutation", DraftInstance, { success: true }>(
  "functions/academic/drafts:commitFormDraft",
);

function asPreviewPayload(payload: unknown): Record<string, unknown> | undefined {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : undefined;
}

export interface PersistentFormDraftOptions<K extends DraftFormKey> {
  formKey: K;
  schoolId?: Id<"schools">;
  accountId?: string;
  connection: DraftConnection;
  currentData: DraftPayload<K>;
  isDirty: boolean;
  onRestore: (payload: DraftPayload<K>) => void;
  instanceKey: number;
}

/** Thin Convex binding for the reviewed shared draft lifecycle. */
export function usePersistentFormDraft<K extends DraftFormKey>(
  options: PersistentFormDraftOptions<K>,
) {
  const enabled = Boolean(options.schoolId && options.accountId);
  const scope = useMemo<DraftScope | null>(
    () =>
      options.schoolId
        ? { schoolId: options.schoolId, formKey: options.formKey }
        : null,
    [options.formKey, options.schoolId],
  );
  const serverRecord = useQuery(getDraft, enabled && scope ? scope : "skip");
  const begin = useMutation(beginDraft);
  const save = useMutation(saveDraft);
  const discard = useMutation(discardDraft);
  const commit = useMutation(commitDraft);
  const draftId = useRef<Id<"formDrafts"> | null>(null);
  const beginInFlight = useRef<Promise<Id<"formDrafts">> | null>(null);

  useEffect(() => {
    draftId.current = null;
    beginInFlight.current = null;
  }, [options.instanceKey, options.accountId, options.schoolId]);

  useEffect(() => {
    if (serverRecord?.draftId) draftId.current = serverRecord.draftId;
  }, [serverRecord]);

  const ensureDraft = useCallback(async () => {
    if (!scope || !enabled) throw new Error("A validated school and account are required to save this draft.");
    if (draftId.current) return draftId.current;
    if (serverRecord?.draftId) {
      draftId.current = serverRecord.draftId;
      return serverRecord.draftId;
    }
    if (!beginInFlight.current) {
      beginInFlight.current = begin({ ...scope, schemaVersion: 1 })
        .then((result) => {
          draftId.current = result.draftId;
          return result.draftId;
        })
        .finally(() => {
          beginInFlight.current = null;
        });
    }
    return await beginInFlight.current;
  }, [begin, enabled, scope, serverRecord]);

  // Allocate once when approved edits begin. Saves never create replacement instances.
  useEffect(() => {
    if (
      !options.isDirty ||
      !enabled ||
      !options.connection.connected ||
      !options.connection.authenticated ||
      serverRecord !== null ||
      draftId.current ||
      beginInFlight.current
    ) return;
    void ensureDraft().catch(() => {
      // The explicit Save control surfaces the error. A concurrent recovery row
      // will arrive through the query and must be resolved by the user.
    });
  }, [enabled, ensureDraft, options.connection.authenticated, options.connection.connected, options.isDirty, serverRecord]);

  const serverDraft = useMemo<FormDraftSummary | null | undefined>(() => {
    if (!enabled || serverRecord === undefined) return undefined;
    if (serverRecord === null) return null;
    return {
      draftId: serverRecord.draftId,
      formKey: serverRecord.formKey,
      lastSavedAt: serverRecord.lastSavedAt,
      payload: asPreviewPayload(serverRecord.payload),
      revision: serverRecord.revision,
      expiresAt: serverRecord.expiresAt,
      schemaVersion: serverRecord.schemaVersion,
    };
  }, [enabled, serverRecord]);

  const controller = useFormDraft<DraftPayload<K>>({
    formKey: options.formKey,
    contextKey: `${options.schoolId ?? "no-school"}:new`,
    accountId: options.accountId ?? "no-account",
    connection: options.connection,
    currentData: options.currentData,
    isDirty: options.isDirty,
    parsePayload: (payload) => parseDraftPayload(options.formKey, payload),
    serverDraft,
    onRestore: options.onRestore,
    instanceKey: options.instanceKey,
    onSave: async (payload, expectedRevision) => {
      if (!scope) throw new Error("A validated school is required to save this draft.");
      const id = await ensureDraft();
      return await save({
        schoolId: scope.schoolId,
        draftId: id,
        expectedRevision,
        schemaVersion: 1,
        payload,
      });
    },
    onDiscardServerDraft: async (expectedRevision) => {
      if (!scope) return;
      const id = draftId.current ?? serverRecord?.draftId;
      if (!id) return;
      await discard({ schoolId: scope.schoolId, draftId: id, expectedRevision });
    },
    onCommitServerDraft: async (expectedRevision) => {
      if (!scope) return;
      const id = draftId.current ?? serverRecord?.draftId;
      if (!id) return;
      await commit({ schoolId: scope.schoolId, draftId: id, expectedRevision });
    },
  });

  return {
    ...controller,
    serverDraft,
    prepareSubmission: async () => {
      const expectedRevision = await controller.prepareSubmission();
      const id = draftId.current;
      return id && options.schoolId
        ? { schoolId: options.schoolId, draftId: id, expectedRevision }
        : null;
    },
  };
}

export type PersistentFormDraftController = ReturnType<
  typeof usePersistentFormDraft<DraftFormKey>
>;
