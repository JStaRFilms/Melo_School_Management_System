import { ConvexError } from "convex/values";
import { normalizePersonName, normalizeStructuredPersonName } from "@school/shared/name-format";

type NullableString = string | null | undefined;

export type StoredUserNameFields = {
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
};

export type ReadableUserName = {
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
};

export function resolveStoredUserNameFields(args: {
  name?: NullableString;
  firstName?: NullableString;
  middleName?: NullableString;
  lastName?: NullableString;
  fallbackName?: NullableString;
  fallbackFirstName?: NullableString;
  fallbackMiddleName?: NullableString;
  fallbackLastName?: NullableString;
  requiredMessage?: string;
}): StoredUserNameFields {
  const message = args.requiredMessage ?? "Person name is required";
  const hasParts = args.firstName !== undefined || args.middleName !== undefined || args.lastName !== undefined;
  if (hasParts) {
    const { firstName, middleName, lastName } = normalizeStructuredPersonName({
      firstName: args.firstName === undefined ? args.fallbackFirstName : args.firstName,
      middleName: args.middleName === undefined ? args.fallbackMiddleName : args.middleName,
      lastName: args.lastName === undefined ? args.fallbackLastName : args.lastName,
    });
    if (!firstName || !lastName) throw new ConvexError("First and last names are required when entering name parts");
    return { name: [firstName, middleName, lastName].filter(Boolean).join(" "), firstName, middleName, lastName };
  }
  // Full-name edits deliberately retain full-name mode. Never infer name parts.
  if (args.name !== undefined && normalize(args.name) !== normalize(args.fallbackName)) {
    const name = normalize(args.name);
    if (!name) throw new ConvexError(message);
    return { name, firstName: undefined, middleName: undefined, lastName: undefined };
  }
  const name = normalize(args.fallbackName ?? args.name);
  if (!name) throw new ConvexError(message);
  const parts = normalizeStructuredPersonName({ firstName: args.fallbackFirstName, middleName: args.fallbackMiddleName, lastName: args.fallbackLastName });
  return { name: parts.firstName && parts.lastName ? [parts.firstName, parts.middleName, parts.lastName].filter(Boolean).join(" ") : name, ...parts };
}

export function getReadableUserName(user?: {
  name?: NullableString;
  firstName?: NullableString;
  middleName?: NullableString;
  lastName?: NullableString;
} | null): ReadableUserName {
  const { firstName, middleName, lastName } = normalizeStructuredPersonName(user ?? {});
  return {
    displayName: firstName && lastName
      ? [firstName, middleName, lastName].filter(Boolean).join(" ")
      : normalize(user?.name) ?? "",
    firstName: firstName ?? null,
    middleName: middleName ?? null,
    lastName: lastName ?? null,
  };
}

function normalize(value: NullableString) {
  return value ? normalizePersonName(value) || undefined : undefined;
}
