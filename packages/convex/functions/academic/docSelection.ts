/**
 * Shared "most recent document" selector for academic Convex functions.
 *
 * Picks the doc with the greatest (updatedAt ?? createdAt ?? 0).
 * Strict `>` comparison preserves first-on-tie ordering.
 */
export function pickMostRecentDoc<
  T extends { updatedAt?: number; createdAt?: number },
>(docs: T[]): T | null {
  return docs.reduce<T | null>((latest, doc) => {
    if (latest === null) {
      return doc;
    }

    const latestTimestamp = latest.updatedAt ?? latest.createdAt ?? 0;
    const docTimestamp = doc.updatedAt ?? doc.createdAt ?? 0;
    return docTimestamp > latestTimestamp ? doc : latest;
  }, null);
}
