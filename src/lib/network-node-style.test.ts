import { describe, expect, it } from "vitest";
import { getNetworkNodeStyle } from "@/lib/network-node-style";

describe("getNetworkNodeStyle", () => {
  it("uses the done style even when the task is critical", () => {
    expect(getNetworkNodeStyle("DONE", true)).toEqual({
      fill: "#f0fdf4",
      stroke: "#16a34a",
      detail: "Done",
    });
  });
});
