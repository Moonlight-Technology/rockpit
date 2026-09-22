export function isNodeEditActivation(key: string) {
  return key === "Enter" || key === " ";
}

export function createNetworkNodeClickGuard() {
  let suppressNextClick = false;

  return {
    recordDrag() {
      suppressNextClick = true;
    },
    shouldOpenEditor() {
      const shouldOpen = !suppressNextClick;
      suppressNextClick = false;
      return shouldOpen;
    },
  };
}

export function addNetworkDependency(
  sourceTaskId: string,
  targetTaskId: string,
  targetDependencyIds: string[],
) {
  if (sourceTaskId === targetTaskId || targetDependencyIds.includes(sourceTaskId)) {
    return null;
  }
  return [...targetDependencyIds, sourceTaskId];
}
