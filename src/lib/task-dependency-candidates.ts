export function getSameBoardDependencyCandidates(
  taskId: string,
  boardId: string | null,
  tasks: Array<{ id: string; boardId: string | null }>
) {
  if (!boardId) return [];
  return tasks.filter((task) => task.id !== taskId && task.boardId === boardId).map((task) => task.id);
}
