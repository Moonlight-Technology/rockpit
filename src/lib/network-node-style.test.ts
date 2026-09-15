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

  it("uses the in-progress style for an open task in the In Progress column", () => {
    expect(getNetworkNodeStyle("TODO", true, true)).toEqual({
      fill: "#fff7ed",
      stroke: "#ea580c",
      detail: "In progress",
    });
  });
});
