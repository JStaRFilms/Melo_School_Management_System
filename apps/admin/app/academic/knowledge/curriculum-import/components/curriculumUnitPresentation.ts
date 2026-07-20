function comparable(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function visibleCurriculumSubtopics(subtopics: string[], objectives: string[]) {
  if (subtopics.length === 0 || subtopics.length !== objectives.length) return subtopics;
  const objectiveValues = new Set(objectives.map(comparable));
  return subtopics.every((item) => objectiveValues.has(comparable(item))) ? [] : subtopics;
}
