import { describe, expect, it } from "vitest";
import { filterDependencyPickerTasks } from "@/lib/dependency-picker";

describe("filterDependencyPickerTasks", () => {
  it("matches task titles without changing the available task order", () => {
    expect(
      filterDependencyPickerTasks("api", [
        { id: "a", title: "Set up API" },
        { id: "b", title: "Review design" },
        { id: "c", title: "Publish API docs" },
      ]).map((task) => task.id),
    ).toEqual(["a", "c"]);
  });
});
