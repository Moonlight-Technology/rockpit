import { describe, expect, it } from "vitest";
import { getValidTaskModalDependencyIds } from "@/lib/task-modal-dependencies";

describe("getValidTaskModalDependencyIds", () => {
  it("removes selected dependencies that are not on the task board", () => {
    expect(
      getValidTaskModalDependencyIds(["task-a", "task-b"], ["task-a", "task-c"]),
    ).toEqual(["task-a"]);
  });
});
