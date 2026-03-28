import { ConvexError } from "convex/values";
import { normalizePersonName } from "@school/shared/name-format";

type NullableString = string | null | undefined;

export type StoredUserNameFields = {
  name: string;
  firstName?: string;
  lastName?: string;
};

export type ReadableUserName = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
};

export function resolveStoredUserNameFields(args: {
  name?: NullableString;
  firstName?: NullableString;
  lastName?: NullableString;
  fallbackName?: NullableString;
  fallbackFirstName?: NullableString;
  fallbackLastName?: NullableString;
  requiredMessage?: string;
}): StoredUserNameFields {
  const explicitFirstName =
    args.firstName === undefined ? undefined : normalizeOptionalPersonName(args.firstName);
  const explicitLastName =
    args.lastName === undefined ? undefined : normalizeOptionalPersonName(args.lastName);

  if (explicitFirstName !== undefined || explicitLastName !== undefined) {
    const firstName = explicitFirstName ?? normalizeOptionalPersonName(args.fallbackFirstName);
    const lastName = explicitLastName ?? normalizeOptionalPersonName(args.fallbackLastName);
    const displayName =
      buildDisplayName(firstName, lastName) ??
      normalizeRequiredDisplayName(
        args.name ?? args.fallbackName,
        args.requiredMessage ?? "Student name is required"
      );
    return cleanStoredFields({ name: displayName, firstName, lastName });
  }

  if (args.name !== undefined) {
    const displayName = normalizeRequiredDisplayName(
      args.name,
      args.requiredMessage ?? "Student name is required"
    );
    const splitName = splitDisplayNameForBackfill(displayName);
    return cleanStoredFields({
      name: displayName,
      firstName: splitName?.firstName,
      lastName: splitName?.lastName,
    });
  }

  const fallback = getReadableUserName({
    name: args.fallbackName,
    firstName: args.fallbackFirstName,
    lastName: args.fallbackLastName,
  });

  if (!fallback.displayName) {
    throw new ConvexError(args.requiredMessage ?? "Student name is required");
  }

  return cleanStoredFields({
    name: fallback.displayName,
    firstName: fallback.firstName ?? undefined,
    lastName: fallback.lastName ?? undefined,
  });
}

export function getReadableUserName(user?: {
  name?: NullableString;
  firstName?: NullableString;
  lastName?: NullableString;
} | null): ReadableUserName {
  const firstName = normalizeOptionalPersonName(user?.firstName);
  const lastName = normalizeOptionalPersonName(user?.lastName);
  const displayNameFromParts = buildDisplayName(firstName, lastName);

  if (displayNameFromParts) {
    return {
      displayName: displayNameFromParts,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
    };
  }

  const fallbackDisplayName = normalizeOptionalDisplayName(user?.name);
  if (!fallbackDisplayName) {
    return {
      displayName: "",
      firstName: null,
      lastName: null,
    };
  }

  const splitName = splitDisplayNameForBackfill(fallbackDisplayName);
  return {
    displayName: fallbackDisplayName,
    firstName: splitName?.firstName ?? null,
    lastName: splitName?.lastName ?? null,
  };
}

function normalizeOptionalPersonName(value: NullableString) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizePersonName(value);
  return normalized || undefined;
}

function normalizeOptionalDisplayName(value: NullableString) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizePersonName(value);
  return normalized || undefined;
}

function normalizeRequiredDisplayName(value: NullableString, errorMessage: string) {
  const normalized = normalizeOptionalDisplayName(value);
  if (!normalized) {
    throw new ConvexError(errorMessage);
  }
  return normalized;
}

function buildDisplayName(firstName?: string, lastName?: string) {
  const parts = [firstName, lastName].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function splitDisplayNameForBackfill(displayName: string) {
  const parts = displayName.split(" ").filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  return {
    firstName: parts[0],
    lastName: parts[1],
  };
}

function cleanStoredFields(fields: StoredUserNameFields): StoredUserNameFields {
  return {
    name: fields.name,
    ...(fields.firstName ? { firstName: fields.firstName } : {}),
    ...(fields.lastName ? { lastName: fields.lastName } : {}),
  };
}
