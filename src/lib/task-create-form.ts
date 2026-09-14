export function getTaskCreateForm(date: string, boardId = "") {
  return {
    title: "",
    description: "",
    startDate: date,
    dueDate: date,
    priority: "MEDIUM" as const,
    boardId,
    columnId: "",
  };
}
