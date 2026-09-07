import { describe, expect, it } from "vitest";
import { toTaskDatePayload } from "@/lib/task-date-payload";

describe("toTaskDatePayload", () => {
  it("serializes both editable task dates as noon UTC timestamps", () => {
    expect(toTaskDatePayload("2026-09-10", "2026-09-14")).toEqual({
      startDate: "2026-09-10T12:00:00.000Z",
      dueDate: "2026-09-14T12:00:00.000Z",
    });
  });
});
