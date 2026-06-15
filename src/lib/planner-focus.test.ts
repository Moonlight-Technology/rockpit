import assert from "node:assert/strict";
import test from "node:test";
import { formatFocusMinutes, summarizeDailyFocus } from "./planner-focus.ts";

const selectedDate = new Date("2026-06-14T00:00:00.000Z");

test("summarizeDailyFocus counts only timer-tracked tasks on the selected day", () => {
  const summary = summarizeDailyFocus(
    [
      {
        id: "timer-1",
        trackedByTimer: true,
        actualDurationMinutes: 90,
        startDate: "2026-06-14T08:00:00.000Z",
      },
      {
        id: "timer-2",
        trackedByTimer: true,
        actualDurationMinutes: 45,
        startDate: "2026-06-14T14:30:00.000Z",
      },
      {
        id: "scheduled-only",
        trackedByTimer: false,
        actualDurationMinutes: 240,
        startDate: "2026-06-14T10:00:00.000Z",
      },
      {
        id: "different-day",
        trackedByTimer: true,
        actualDurationMinutes: 30,
        startDate: "2026-06-13T10:00:00.000Z",
      },
      {
        id: "missing-duration",
        trackedByTimer: true,
        actualDurationMinutes: null,
        startDate: "2026-06-14T16:00:00.000Z",
      },
    ],
    selectedDate
  );

  assert.deepEqual(summary, {
    totalFocusMinutes: 135,
    sessionCount: 2,
  });
});

test("formatFocusMinutes returns compact hour and minute labels", () => {
  assert.equal(formatFocusMinutes(0), "0m");
  assert.equal(formatFocusMinutes(25), "25m");
  assert.equal(formatFocusMinutes(60), "1j 0m");
  assert.equal(formatFocusMinutes(145), "2j 25m");
});
