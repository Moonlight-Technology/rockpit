export const NETWORK_ZOOM_DEFAULT = 1;
export const NETWORK_ZOOM_MIN = 0.5;
export const NETWORK_ZOOM_MAX = 2;

export function clampNetworkZoom(value: number) {
  return Math.min(NETWORK_ZOOM_MAX, Math.max(NETWORK_ZOOM_MIN, value));
}
