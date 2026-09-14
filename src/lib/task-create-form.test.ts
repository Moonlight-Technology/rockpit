import { describe, expect, it } from "vitest";
import { getTaskCreateForm } from "@/lib/task-create-form";

describe("getTaskCreateForm", () => {
  it("preselects the board chosen in Critical Path", () => {
    expect(getTaskCreateForm("2026-09-14", "board-1")).toMatchObject({
      boardId: "board-1",
      columnId: "",
      priority: "MEDIUM",
    });
  });
});
