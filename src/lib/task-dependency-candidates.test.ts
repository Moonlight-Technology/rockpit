import { describe, expect, it } from "vitest";
import { getSameBoardDependencyCandidates } from "@/lib/task-dependency-candidates";

describe("getSameBoardDependencyCandidates", () => {
  it("only returns sibling tasks from the selected task board", () => {
    expect(getSameBoardDependencyCandidates("a", "board-1", [
      { id: "a", boardId: "board-1" },
      { id: "b", boardId: "board-1" },
      { id: "c", boardId: "board-2" },
    ])).toEqual(["b"]);
  });
});
