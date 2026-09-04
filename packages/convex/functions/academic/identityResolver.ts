import { ConvexError } from "convex/values";

export interface AuthIdentity {
  subject?: string;
  tokenIdentifier?: string;
  issuer?: string;
}

export interface LegacyIdentityRow {
  authId: string;
  authTokenIdentifier?: string;
}

export interface IdentityLookup<Row extends LegacyIdentityRow> {
  byTokenIdentifier: (tokenIdentifier: string) => Promise<Row[]>;
  bySubject: (subject: string) => Promise<Row[]>;
}

const trustedLegacySubjectIssuer = process.env.LEGACY_SUBJECT_TRUSTED_ISSUER?.trim();

export function isTrustedLegacySubjectIssuer(issuer: string | undefined): boolean {
  return Boolean(trustedLegacySubjectIssuer && issuer === trustedLegacySubjectIssuer);
}

/**
 * Resolves exactly one identity-linked row. Canonical token identifiers always
 * win; subject fallback is limited to unlinked legacy rows from one trusted
 * issuer. Bounded lookup results make duplicate data an authorization failure.
 */
export async function resolveTokenFirstTrustedLegacyRow<Row extends LegacyIdentityRow>(
  identity: AuthIdentity,
  lookup: IdentityLookup<Row>
): Promise<Row | null> {
  if (identity.tokenIdentifier) {
    const tokenRows = await lookup.byTokenIdentifier(identity.tokenIdentifier);
    if (tokenRows.length > 1) {
      throw new ConvexError("Unauthorized: ambiguous canonical identity");
    }
    if (tokenRows.length === 1) {
      return tokenRows[0];
    }
  }

  if (!identity.subject) {
    return null;
  }
  if (!isTrustedLegacySubjectIssuer(identity.issuer)) {
    throw new ConvexError("Unauthorized: untrusted legacy identity issuer");
  }

  const subjectRows = await lookup.bySubject(identity.subject);
  if (subjectRows.length > 1) {
    throw new ConvexError("Unauthorized: ambiguous legacy identity");
  }
  const legacyRow = subjectRows[0] ?? null;
  if (!legacyRow) {
    return null;
  }
  if (legacyRow.authTokenIdentifier) {
    throw new ConvexError("Unauthorized: mismatched canonical identity link");
  }
  return legacyRow;
}
