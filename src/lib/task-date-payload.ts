export function toTaskDatePayload(startDate: string, dueDate: string) {
  return {
    startDate: `${startDate}T12:00:00.000Z`,
    dueDate: `${dueDate}T12:00:00.000Z`,
  };
}
