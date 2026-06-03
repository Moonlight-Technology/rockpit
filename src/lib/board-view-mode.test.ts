import assert from "node:assert/strict";
import test from "node:test";
import { parseBoardViewMode } from "./board-view-mode.ts";

test("parseBoardViewMode keeps valid stored values", () => {
  assert.equal(parseBoardViewMode("board"), "board");
  assert.equal(parseBoardViewMode("list"), "list");
});

test("parseBoardViewMode falls back to board for invalid values", () => {
  assert.equal(parseBoardViewMode(null), "board");
  assert.equal(parseBoardViewMode(undefined), "board");
  assert.equal(parseBoardViewMode("kanban"), "board");
  assert.equal(parseBoardViewMode(""), "board");
});
