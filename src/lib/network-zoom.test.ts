import { describe, expect, it } from "vitest";
import { clampNetworkZoom, NETWORK_ZOOM_DEFAULT } from "@/lib/network-zoom";

describe("clampNetworkZoom", () => {
  it("keeps zoom between 50% and 200% and restores the default", () => {
    expect(clampNetworkZoom(0.3)).toBe(0.5);
    expect(clampNetworkZoom(2.4)).toBe(2);
    expect(NETWORK_ZOOM_DEFAULT).toBe(1);
  });
});
