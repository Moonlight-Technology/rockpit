import { describe, expect, it } from "vitest";
import { isNodeEditActivation } from "@/lib/network-node-interaction";

describe("isNodeEditActivation", () => {
  it("accepts Enter and Space but ignores navigation keys", () => {
    expect(isNodeEditActivation("Enter")).toBe(true);
    expect(isNodeEditActivation(" ")).toBe(true);
    expect(isNodeEditActivation("ArrowRight")).toBe(false);
  });
});
