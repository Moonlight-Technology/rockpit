import { describe, expect, it } from "vitest";
import { updateTaskScheduleSchema } from "@/lib/validators/board";

describe("updateTaskScheduleSchema", () => {
  it("accepts a multi-day time range created by the board task editor", () => {
    expect(
      updateTaskScheduleSchema.safeParse({
        plannedStartAt: "2026-09-15T08:00:00.000Z",
        plannedDurationMinutes: 3 * 24 * 60,
      }).success,
    ).toBe(true);
  });
});
