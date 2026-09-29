/**
 * Bounded-read asserts (consolidation P13). Names the take(N)+over-limit
 * pattern so quota reviews grep one helper. Limits and error context stay
 * with each caller; unbounded collects are out of scope.
 */
export function assertBoundedRows<T>(
  rows: readonly T[],
  limit: number,
  makeError: () => never,
): T[] {
  if (rows.length > limit) throw makeError();
  return [...rows];
}
