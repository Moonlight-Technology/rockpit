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
