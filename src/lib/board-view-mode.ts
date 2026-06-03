export type BoardViewMode = "board" | "list";

export function parseBoardViewMode(value: unknown): BoardViewMode {
  return value === "list" ? "list" : "board";
}
