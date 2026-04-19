import { ConvexError } from "convex/values";
import type { KnowledgeActorContext } from "./lessonKnowledgeAccess";

export type KnowledgeSearchSurface =
  | "knowledgeTopics"
  | "knowledgeMaterials"
  | "knowledgeMaterialChunks"
  | "instructionArtifacts"
  | "instructionArtifactDocuments"
  | "assessmentBanks"
  | "assessmentBankItems";

export type KnowledgeSearchContract = {
  tableName: KnowledgeSearchSurface;
  indexName: string;
  searchField: string;
  filterFields: readonly string[];
  requiresStaffAccess: boolean;
};

export const KNOWLEDGE_SEARCH_CONTRACTS = {
  knowledgeTopics: {
    tableName: "knowledgeTopics",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "isActive", "subjectId"],
    requiresStaffAccess: true,
  },
  knowledgeMaterials: {
    tableName: "knowledgeMaterials",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "visibility", "reviewStatus", "topicId", "sourceType"],
    requiresStaffAccess: true,
  },
  knowledgeMaterialChunks: {
    tableName: "knowledgeMaterialChunks",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "visibility", "reviewStatus", "topicId", "materialId"],
    requiresStaffAccess: true,
  },
  instructionArtifacts: {
    tableName: "instructionArtifacts",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "visibility", "reviewStatus", "topicId", "outputType"],
    requiresStaffAccess: true,
  },
  instructionArtifactDocuments: {
    tableName: "instructionArtifactDocuments",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "visibility", "reviewStatus", "topicId", "outputType"],
    requiresStaffAccess: true,
  },
  assessmentBanks: {
    tableName: "assessmentBanks",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "visibility", "reviewStatus", "topicId", "outputType"],
    requiresStaffAccess: true,
  },
  assessmentBankItems: {
    tableName: "assessmentBankItems",
    indexName: "search_search_text",
    searchField: "searchText",
    filterFields: ["schoolId", "visibility", "reviewStatus", "bankId", "questionType"],
    requiresStaffAccess: true,
  },
} as const satisfies Record<KnowledgeSearchSurface, KnowledgeSearchContract>;

export function getKnowledgeSearchContract(
  surface: KnowledgeSearchSurface
): KnowledgeSearchContract {
  return KNOWLEDGE_SEARCH_CONTRACTS[surface];
}

export function normalizeKnowledgeSearchQuery(rawQuery: string): string {
  return rawQuery.trim().replace(/\s+/g, " ");
}

export function assertKnowledgeSearchQuery(rawQuery: string): string {
  const normalized = normalizeKnowledgeSearchQuery(rawQuery);
  if (!normalized) {
    throw new ConvexError("Search query is required");
  }

  if (normalized.length > 200) {
    throw new ConvexError("Search query is too long");
  }

  return normalized;
}

export function canUseKnowledgeSearch(actor: KnowledgeActorContext): boolean {
  return actor.role === "teacher" || actor.isSchoolAdmin || actor.role === "admin";
}

export function assertKnowledgeSearchAccess(actor: KnowledgeActorContext): void {
  if (!canUseKnowledgeSearch(actor)) {
    throw new ConvexError("Knowledge search is restricted to staff");
  }
}
