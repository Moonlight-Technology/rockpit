import type { CriticalPathTask } from "@/components/helicopter/critical-path-panel";

type BoardCriticalPathSourceTask = Omit<CriticalPathTask, "column"> & {
  columnTitle: string;
};

export function toBoardCriticalPathTasks(
  tasks: BoardCriticalPathSourceTask[],
): CriticalPathTask[] {
  return tasks.map(({ columnTitle, ...task }) => ({
    ...task,
    column: { title: columnTitle },
  }));
}
