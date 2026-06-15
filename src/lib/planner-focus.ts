import { isSameDay } from "date-fns";

type FocusTask = {
  id: string;
  trackedByTimer: boolean;
  actualDurationMinutes: number | null;
  startDate: string | null;
};

export function summarizeDailyFocus(tasks: FocusTask[], selectedDate: Date) {
  return tasks.reduce(
    (summary, task) => {
      if (!task.trackedByTimer || task.actualDurationMinutes == null || !task.startDate) {
        return summary;
      }

      if (!isSameDay(new Date(task.startDate), selectedDate)) {
        return summary;
      }

      return {
        totalFocusMinutes: summary.totalFocusMinutes + task.actualDurationMinutes,
        sessionCount: summary.sessionCount + 1,
      };
    },
    { totalFocusMinutes: 0, sessionCount: 0 }
  );
}

export function formatFocusMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}j ${minutes}m`;
}
