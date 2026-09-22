import { describe, expect, it } from "vitest";
import {
  addNetworkDependency,
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

describe("addNetworkDependency", () => {
  it("adds the source task once as a prerequisite of the target", () => {
    expect(addNetworkDependency("task-a", "task-b", ["task-c"])).toEqual([
      "task-c",
      "task-a",
    ]);
  });

  it("rejects self-links and existing dependencies", () => {
    expect(addNetworkDependency("task-a", "task-a", [])).toBeNull();
    expect(addNetworkDependency("task-a", "task-b", ["task-a"])).toBeNull();
  });
});
