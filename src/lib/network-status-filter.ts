export type NetworkStatusFilter = "all" | "open" | "done";

export function getVisibleNetworkTaskIds(
  tasks: Array<{ id: string; status: "TODO" | "DONE" }>,
  filter: NetworkStatusFilter
) {
  return new Set(
    tasks
      .filter((task) => filter === "all" || (filter === "done" ? task.status === "DONE" : task.status !== "DONE"))
      .map((task) => task.id)
  );
}
