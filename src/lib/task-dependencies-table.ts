export type DependencyTableStatus = "all" | "open" | "done";
export type DependencyTableSort = { key: "startDate" | "dueDate"; direction: "asc" | "desc" };

type SortableTask = { status: "TODO" | "DONE"; startDate: string | null; dueDate: string | null };

export function filterAndSortDependencyTasks<T extends SortableTask>(
  tasks: T[],
  status: DependencyTableStatus,
  sort: DependencyTableSort
) {
  return tasks
    .filter((task) => status === "all" || (status === "done" ? task.status === "DONE" : task.status !== "DONE"))
    .toSorted((a, b) => {
      const aValue = a[sort.key] ? new Date(a[sort.key] as string).getTime() : Number.MAX_SAFE_INTEGER;
      const bValue = b[sort.key] ? new Date(b[sort.key] as string).getTime() : Number.MAX_SAFE_INTEGER;
      const comparison = aValue - bValue;
      return sort.direction === "asc" ? comparison : -comparison;
    });
}
