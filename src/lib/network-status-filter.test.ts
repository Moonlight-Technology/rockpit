import { describe, expect, it } from "vitest";
import { getVisibleNetworkTaskIds } from "@/lib/network-status-filter";

describe("getVisibleNetworkTaskIds", () => {
  it("filters visible nodes without changing the source task list", () => {
    expect(getVisibleNetworkTaskIds([
      { id: "open", status: "TODO" },
      { id: "done", status: "DONE" },
    ], "open")).toEqual(new Set(["open"]));
  });
});
