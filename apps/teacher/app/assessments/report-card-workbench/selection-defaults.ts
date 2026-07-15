type IdentifiedOption = {
  id: string;
};

export function getDefaultTermId(
  terms: IdentifiedOption[],
  activeTerms: IdentifiedOption[]
) {
  const activeTermIds = new Set(activeTerms.map((term) => term.id));
  return terms.find((term) => activeTermIds.has(term.id))?.id ?? terms[0]?.id ?? null;
}
