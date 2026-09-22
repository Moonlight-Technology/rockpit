import { describe, expect, it } from "vitest";
import {
  createNetworkNodeClickGuard,
  isNodeEditActivation,
} from "@/lib/network-node-interaction";

describe("isNodeEditActivation", () => {
  it("accepts Enter and Space but ignores navigation keys", () => {
    expect(isNodeEditActivation("Enter")).toBe(true);
    expect(isNodeEditActivation(" ")).toBe(true);
    expect(isNodeEditActivation("ArrowRight")).toBe(false);
  });
});

describe("network node click guard", () => {
  it("suppresses only the click emitted after a drag", () => {
    const guard = createNetworkNodeClickGuard();

    expect(guard.shouldOpenEditor()).toBe(true);
    guard.recordDrag();
    expect(guard.shouldOpenEditor()).toBe(false);
    expect(guard.shouldOpenEditor()).toBe(true);
  });
});
