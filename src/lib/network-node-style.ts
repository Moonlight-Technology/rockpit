export function getNetworkNodeStyle(
  status: "TODO" | "DONE",
  critical: boolean,
  inProgress = false,
) {
  if (status === "DONE") {
    return {
      fill: "#f0fdf4",
      stroke: "#16a34a",
      detail: "Done",
    };
  }

  if (inProgress) {
    return {
      fill: "#fff7ed",
      stroke: "#ea580c",
      detail: "In progress",
    };
  }

  return {
    fill: critical ? "#fef2f2" : "white",
    stroke: critical ? "#dc2626" : "#94a3b8",
    detail: critical ? "Critical" : null,
  };
}
