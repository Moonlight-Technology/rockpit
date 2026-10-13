import assert from "node:assert/strict";
import { test } from "vitest";
import { getAvatarBackgroundColor } from "./avatar-color.ts";

test("getAvatarBackgroundColor preserves the user's selected warm color", () => {
  assert.equal(getAvatarBackgroundColor("#F4A261"), "#F4A261");
});

test("getAvatarBackgroundColor falls back to the profile default for missing colors", () => {
  assert.equal(getAvatarBackgroundColor(null), "#E76F51");
});
