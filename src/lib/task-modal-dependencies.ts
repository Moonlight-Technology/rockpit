export function getValidTaskModalDependencyIds(
  selectedDependencyIds: string[],
  candidateDependencyIds: string[],
) {
  const candidateIds = new Set(candidateDependencyIds);
  return selectedDependencyIds.filter((dependencyId) => candidateIds.has(dependencyId));
}
