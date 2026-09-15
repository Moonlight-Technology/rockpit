import { describe, expect, it } from "vitest";
import {
  clampNetworkPosition,
  isNetworkNodeDrag,
  mergeNetworkNodePositions,
} from "@/lib/network-layout";

describe("network layout helpers", () => {
  it("overlays saved nodes and keeps automatic positions for the rest", () => {
    expect(
      mergeNetworkNodePositions(
        {
          a: { x: 36, y: 36, layer: 0 },
          b: { x: 316, y: 36, layer: 1 },
        },
        [{ taskId: "b", x: 480, y: 200 }],
      ),
    ).toEqual({
      a: { x: 36, y: 36, layer: 0 },
      b: { x: 480, y: 200, layer: 1 },
    });
  });

  it("clamps invalid drag coordinates", () => {
    expect(clampNetworkPosition({ x: -24, y: 90000 })).toEqual({ x: 0, y: 20000 });
  });

  it("only classifies movement of at least four pixels as a drag", () => {
    expect(isNetworkNodeDrag({ x: 20, y: 20 }, { x: 23, y: 22 })).toBe(false);
    expect(isNetworkNodeDrag({ x: 100, y: 100 }, { x: 104, y: 100 })).toBe(true);
  });
});
