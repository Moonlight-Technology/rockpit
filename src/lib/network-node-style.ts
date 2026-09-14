export function getNetworkNodeStyle(
  status: "TODO" | "DONE",
  critical: boolean,
) {
  if (status === "DONE") {
    return {
      fill: "#f0fdf4",
      stroke: "#16a34a",
      detail: "Done",
    };
  }

  return {
    fill: critical ? "#fef2f2" : "white",
    stroke: critical ? "#dc2626" : "#94a3b8",
    detail: critical ? "Critical" : null,
  };
}
