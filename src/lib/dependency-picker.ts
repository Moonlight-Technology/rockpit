export type DependencyPickerTask = {
  id: string;
  title: string;
};

export function filterDependencyPickerTasks(
  query: string,
  tasks: DependencyPickerTask[],
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tasks;

  return tasks.filter((task) =>
    task.title.toLowerCase().includes(normalizedQuery),
  );
}
